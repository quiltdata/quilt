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

interface ErrorLike {
  name: string
  message: string
}

function mapPreviewError(retry: () => void, e?: ErrorLike) {
  switch (e?.name) {
    case 'BucketNotBrowsable':
      return PreviewError.Forbidden()
    case 'BucketNotFound':
      return PreviewError.DoesNotExist()
    case 'SessionNotFound':
      return PreviewError.Expired({ retry })
    case 'OwnerMismatch':
      return PreviewError.Forbidden()
    default:
      return PreviewError.Unexpected({ retry })
  }
}

function useCreateSession() {
  const createSession = GQL.useMutation(CREATE_BROWSING_SESSION)
  return React.useCallback(
    async (scope: string, ttl) => {
      const { browsingSessionCreate: r } = await createSession({ scope, ttl })
      switch (r.__typename) {
        case 'BrowsingSession':
          return r
        case 'OperationError':
          throw r
        case 'InvalidInput':
          throw new Error(
            r.errors
              .map(({ message, path }) => `{ message: ${message}, path: ${path} }`)
              .join('\n'),
          )
        default:
          assertNever(r)
      }
    },
    [createSession],
  )
}

function useRefreshSession() {
  const refreshSession = GQL.useMutation(REFRESH_BROWSING_SESSION)
  return React.useCallback(
    async (id: string, ttl: number) => {
      const { browsingSessionRefresh: r } = await refreshSession({ id, ttl })
      switch (r.__typename) {
        case 'BrowsingSession':
          return r
        case 'OperationError':
          throw r
        case 'InvalidInput':
          throw new Error(
            r.errors
              .map(({ message, path }) => `{ message: ${message}, path: ${path} }`)
              .join('\n'),
          )
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
    (id?: string) => (id ? disposeSession({ id }) : null),
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
    let ignore = false
    let sessionId: SessionId = ''
    let timer: NodeJS.Timer

    async function initSession() {
      try {
        setResult(AsyncResult.Pending())
        const session = await createSession(scope, SESSION_TTL)
        if (ignore) return
        sessionId = session.id
        setResult(AsyncResult.Ok(sessionId))

        timer = setInterval(async () => {
          try {
            if (!sessionId) return
            await refreshSession(sessionId, SESSION_TTL)
          } catch (e) {
            clearInterval(timer)
            log.error(e)
            Sentry.captureException(e)
            if (!ignore) {
              setResult(AsyncResult.Err(mapPreviewError(retry, e as ErrorLike)))
            }
          }
        }, REFRESH_INTERVAL)
      } catch (e) {
        clearInterval(timer)
        Sentry.captureException(e)
        log.error(e)
        if (!ignore) {
          setResult(AsyncResult.Err(mapPreviewError(retry, e as ErrorLike)))
        }
      }
    }

    initSession()

    return () => {
      ignore = true
      clearInterval(timer)
      disposeSession(sessionId)
    }
  }, [key, createSession, disposeSession, refreshSession, retry, scope])

  return result
}

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
            sandbox: 'allow-scripts allow-same-origin',
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
        sandbox: browsable ? 'allow-scripts allow-same-origin' : 'allow-scripts',
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
