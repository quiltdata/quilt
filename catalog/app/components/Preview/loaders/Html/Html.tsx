import * as R from 'ramda'
import * as React from 'react'
import * as Sentry from '@sentry/react'

import cfg from 'constants/config'
import type * as Model from 'model'
import * as AWS from 'utils/AWS'
import AsyncResult from 'utils/AsyncResult'
import { useIsInStack } from 'utils/BucketConfig'
import * as GQL from 'utils/GraphQL'
import log from 'utils/Logging'
import type * as LogicalKeyResolver from 'utils/LogicalKeyResolver'
import { useEnsurePFSCookie } from 'utils/PFSCookieManager'
import * as PackageUri from 'utils/PackageUri'
import { useStatusReportsBucket } from 'utils/StatusReportsBucket'
import assertNever from 'utils/assertNever'
import type { PackageHandle } from 'utils/packageHandle'

import { PreviewError, PreviewData } from '../../types'

import * as Text from '../Text'
import FileType from '../fileType'
import * as utils from '../utils'

import BUCKET_CONFIG_QUERY from './gql/BrowsableBucketConfig.generated'
import CREATE_BROWSING_SESSION from './gql/CreateBrowsingSession.generated'
import DISPOSE_BROWSING_SESSION from './gql/DisposeBrowsingSession.generated'
import REFRESH_BROWSING_SESSION from './gql/RefreshBrowsingSession.generated'

export const detect = utils.extIn(['.htm', '.html'])

export const FILE_TYPE = FileType.Html

const SESSION_TTL = 60 * 3
const REFRESH_INTERVAL = SESSION_TTL * 0.2 * 1000

type SessionId = Model.GQLTypes.BrowsingSession['id']
type CreateData = GQL.DataForDoc<typeof CREATE_BROWSING_SESSION>['browsingSessionCreate']
type GQLErrorData = Extract<CreateData, { __typename: 'OperationError' | 'InvalidInput' }>

class GQLError extends Error {
  op: 'create' | 'refresh'

  data: GQLErrorData

  constructor(op: 'create' | 'refresh', data: GQLErrorData) {
    super()
    this.op = op
    this.data = data
  }
}

function mapPreviewError(retry: () => void, e: any) {
  if (!(e instanceof GQLError)) {
    return PreviewError.Unexpected({ retry, message: e.message })
  }

  switch (e.data.__typename) {
    case 'OperationError':
      switch (e.data.name) {
        case 'BucketNotBrowsable':
          return PreviewError.Forbidden()
        case 'BucketNotFound':
          return PreviewError.DoesNotExist()
        case 'SessionNotFound':
          return PreviewError.Expired({ retry })
        case 'OwnerMismatch':
          return PreviewError.Forbidden()
        default:
          const message = (
            <>
              Could not {e.op} browsing session: {e.data.__typename}(${e.data.name})
              <br />${e.data.message}`
            </>
          )
          return PreviewError.Unexpected({ retry, message })
      }
    case 'InvalidInput':
      const message = (
        <>
          Could not {e.op} browsing session: {e.data.__typename}
          {e.data.errors.map((ie) => (
            <React.Fragment key={`${ie.path}:${ie.name}`}>
              <br />
              {ie.name}
              {!!ie.path && ` at ${ie.path}`}: {ie.message}
            </React.Fragment>
          ))}
        </>
      )
      return PreviewError.Unexpected({ retry, message })
    default:
      assertNever(e.data)
  }
}

function useCreateSession() {
  const createSession = GQL.useMutation(CREATE_BROWSING_SESSION)
  const ensureCookie = useEnsurePFSCookie()
  return React.useCallback(
    async (scope: string) => {
      const { browsingSessionCreate: r } = await createSession({
        scope,
        ttl: SESSION_TTL,
      })
      switch (r.__typename) {
        case 'BrowsingSession':
          await ensureCookie()
          return r
        case 'OperationError':
        case 'InvalidInput':
          throw new GQLError('create', r)
        default:
          assertNever(r)
      }
    },
    [createSession, ensureCookie],
  )
}

function useRefreshSession() {
  const refreshSession = GQL.useMutation(REFRESH_BROWSING_SESSION)
  return React.useCallback(
    async (id: SessionId | null) => {
      if (!id) return
      const { browsingSessionRefresh: r } = await refreshSession({ id, ttl: SESSION_TTL })
      switch (r.__typename) {
        case 'BrowsingSession':
          return
        case 'OperationError':
        case 'InvalidInput':
          throw new GQLError('refresh', r)
        default:
          assertNever(r)
      }
    },
    [refreshSession],
  )
}

function useDisposeSession() {
  const disposeSession = GQL.useMutation(DISPOSE_BROWSING_SESSION)
  return React.useCallback(
    (id: SessionId | null) => {
      if (id) disposeSession({ id })
    },
    [disposeSession],
  )
}

interface FileHandle extends LogicalKeyResolver.S3SummarizeHandle {
  packageHandle: PackageHandle
}

function useSession(handle: FileHandle) {
  const [result, setResult] = React.useState(AsyncResult.Pending())
  const [key, setKey] = React.useState(0)
  const retry = React.useCallback(() => setKey(R.inc), [])

  const createSession = useCreateSession()
  const disposeSession = useDisposeSession()
  const refreshSession = useRefreshSession()

  const scope = PackageUri.stringify(handle.packageHandle)

  React.useEffect(() => {
    let disposed = false
    let sessionId: SessionId | null = null
    let timer: NodeJS.Timer

    const handleError = (e: unknown) => {
      if (disposed) return
      log.error(e)
      Sentry.captureException(e)
      clearInterval(timer)
      setResult(AsyncResult.Err(mapPreviewError(retry, e)))
    }

    createSession(scope).then(({ id }) => {
      if (disposed) return
      sessionId = id
      setResult(AsyncResult.Ok(sessionId))
      timer = setInterval(
        () => refreshSession(sessionId).catch(handleError),
        REFRESH_INTERVAL,
      )
    }, handleError)

    return () => {
      disposed = true
      clearInterval(timer)
      disposeSession(sessionId)
    }
  }, [key, createSession, disposeSession, refreshSession, retry, scope])

  return result
}

const SANDBOX_BROWSABLE = [
  'allow-scripts',
  'allow-same-origin',
  'allow-forms',
  'allow-popups',
].join(' ')

const SANDBOX_RESTRICTED = 'allow-scripts'

interface IFrameLoaderBrowsableProps {
  children: (result: $TSFixMe) => JSX.Element
  handle: FileHandle
}

function IFrameLoaderBrowsable({ handle, children }: IFrameLoaderBrowsableProps) {
  const sessionData = useSession(handle)
  return children(
    AsyncResult.mapCase(
      {
        Ok: (sessionId: SessionId) =>
          PreviewData.IFrame({
            src: `${cfg.s3Proxy}/browse/${sessionId}/${handle.logicalKey}`,
            modes: [FileType.Html, FileType.Text],
            sandbox: SANDBOX_BROWSABLE,
          }),
      },
      sessionData,
    ),
  )
}

interface IFrameLoaderSignedProps {
  children: (result: $TSFixMe) => JSX.Element
  handle: Model.S3.S3ObjectLocation
  browsable: boolean
}

function IFrameLoaderSigned({ handle, browsable, children }: IFrameLoaderSignedProps) {
  const sign = AWS.Signer.useS3Signer()
  const src = React.useMemo(
    () => sign(handle, { ResponseContentType: 'text/html' }),
    [handle, sign],
  )
  // TODO: issue a head request to ensure existence and get storage class
  return children(
    AsyncResult.Ok(
      PreviewData.IFrame({
        src,
        modes: [FileType.Html, FileType.Text],
        sandbox: browsable ? SANDBOX_BROWSABLE : SANDBOX_RESTRICTED,
      }),
    ),
  )
}

interface IFrameLoaderProps {
  children: (result: $TSFixMe) => JSX.Element
  handle: FileHandle
}

function IFrameLoader({ handle, children }: IFrameLoaderProps) {
  const bucketData = GQL.useQuery(BUCKET_CONFIG_QUERY, { bucket: handle.bucket })
  const inPackage = !!handle.packageHandle
  return GQL.fold(bucketData, {
    fetching: () => children(AsyncResult.Pending()),
    error: (e) => children(AsyncResult.Err(e)),
    data: ({ bucketConfig }) =>
      bucketConfig?.browsable && inPackage ? (
        <IFrameLoaderBrowsable {...{ handle, children }} />
      ) : (
        <IFrameLoaderSigned
          {...{ handle, children }}
          browsable={!!bucketConfig?.browsable}
        />
      ),
  })
}

// It's unsafe to render HTML in these conditions
function useHtmlAsText(handle: Model.S3.S3ObjectLocation) {
  const isInStack = useIsInStack()
  const statusReportsBucket = useStatusReportsBucket()
  return (
    cfg.mode !== 'LOCAL' &&
    !isInStack(handle.bucket) &&
    handle.bucket !== statusReportsBucket
  )
}

interface LoaderProps {
  children: (result: $TSFixMe) => JSX.Element
  handle: FileHandle
}

export const Loader = function HtmlLoader({ handle, children }: LoaderProps) {
  return useHtmlAsText(handle) ? (
    <Text.Loader {...{ handle, children }} />
  ) : (
    <IFrameLoader {...{ handle, children }} />
  )
}
