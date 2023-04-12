import * as R from 'ramda'
import * as React from 'react'
import * as Sentry from '@sentry/react'

import cfg from 'constants/config'
import type * as Model from 'model'
import AsyncResult from 'utils/AsyncResult'
import { useMutation } from 'utils/GraphQL'
import log from 'utils/Logging'
import type * as LogicalKeyResolver from 'utils/LogicalKeyResolver'
import * as PackageUri from 'utils/PackageUri'
import assertNever from 'utils/assertNever'
import type { PackageHandle } from 'utils/packageHandle'

import { PreviewError, PreviewData } from '../../types'

import FileType from '../fileType'

import CREATE_BROWSING_SESSION from './CreateBrowsingSession.generated'
import DISPOSE_BROWSING_SESSION from './DisposeBrowsingSession.generated'
import REFRESH_BROWSING_SESSION from './RefreshBrowsingSession.generated'

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
  const createSession = useMutation(CREATE_BROWSING_SESSION)
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
  const refreshSession = useMutation(REFRESH_BROWSING_SESSION)
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
  const disposeSession = useMutation(DISPOSE_BROWSING_SESSION)
  return React.useCallback(
    (id?: string) => (id ? disposeSession({ id }) : null),
    [disposeSession],
  )
}

interface FileHandle extends LogicalKeyResolver.S3SummarizeHandle {
  packageHandle: PackageHandle
}

interface BrowsableLoaderProps {
  children: (result: $TSFixMe) => React.ReactNode
  handle: FileHandle
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

export default function BrowsableLoader({ handle, children }: BrowsableLoaderProps) {
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
