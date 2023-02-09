import * as R from 'ramda'
import * as React from 'react'
import * as urql from 'urql'

import cfg from 'constants/config'
import * as Model from 'model'
import AsyncResult from 'utils/AsyncResult'
import log from 'utils/Logging'
import * as LogicalKeyResolver from 'utils/LogicalKeyResolver'
import * as PackageUri from 'utils/PackageUri'
import type { PackageHandle } from 'utils/packageHandle'

import { PreviewError, PreviewData } from '../../types'

import FileType from '../fileType'

import CREATE_BROWSING_SESSION from './CreateBrowsingSession.generated'
import DISPOSE_BROWSING_SESSION from './DisposeBrowsingSession.generated'
import REFRESH_BROWSING_SESSION from './RefreshBrowsingSession.generated'

const SESSION_TTL = 60 * 60

type Session = Model.GQLTypes.BrowsingSession

function useCreateSession() {
  const [, createSession] = urql.useMutation(CREATE_BROWSING_SESSION)
  return React.useCallback(
    async (scope: string, ttl) => {
      const res = await createSession({ scope, ttl })
      if (res.error) throw res.error
      if (!res.data) throw new Error('No data')
      const r = res.data.browsingSessionCreate
      switch (r.__typename) {
        case 'BrowsingSession':
          return r
        case 'OperationError':
          throw new Error(r.message)
        case 'InvalidInput':
          throw new Error(
            r.errors
              .map(({ message, path }) => `{message: ${message}, path: ${path} }`)
              .join('\n'),
          )
        default:
          throw r
      }
    },
    [createSession],
  )
}

function useRefreshSession() {
  const [, refreshSession] = urql.useMutation(REFRESH_BROWSING_SESSION)
  return React.useCallback(
    async (id: string, ttl: number) => {
      const res = await refreshSession({ id, ttl })
      if (res.error) throw res.error
      if (!res.data) throw new Error('No data')
      const r = res.data.browsingSessionRefresh
      switch (r.__typename) {
        case 'BrowsingSession':
          return r
        case 'OperationError':
          throw new Error(r.message)
        case 'InvalidInput':
          throw new Error(
            r.errors
              .map(({ message, path }) => `{message: ${message}, path: ${path} }`)
              .join('\n'),
          )
        default:
          throw r
      }
    },
    [refreshSession],
  )
}

function useDisposeSession() {
  const [, disposeSession] = urql.useMutation(DISPOSE_BROWSING_SESSION)
  return React.useCallback(
    (id?: string) => {
      if (!id) return
      return disposeSession({ id })
    },
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
  const [error, setError] = React.useState<Error | unknown | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [session, setSession] = React.useState<Session | null>(null)
  const [key, setKey] = React.useState(0)
  // TODO: move `retry` to upper level
  const retry = React.useCallback(() => {
    setError(null)
    setLoading(true)
    setKey(R.inc)
  }, [])

  const createSession = useCreateSession()
  const disposeSession = useDisposeSession()
  const refreshSession = useRefreshSession()

  const scope = PackageUri.stringify(handle.packageHandle)

  React.useEffect(() => {
    let ignore = false
    let sessionClosure: Session | null = null

    async function requestSession() {
      try {
        const s = await createSession(scope, SESSION_TTL)
        if (ignore) return
        sessionClosure = s
        setSession(s)
      } catch (e) {
        if (
          /Bucket [^ ]* is not browsable/.test((e as Record<'message', string>)?.message)
        ) {
          setError(PreviewError.Forbidden())
        } else {
          setError(PreviewError.Unexpected({ retry }))
        }
        log.error(e)
      }
      setLoading(false)
    }

    requestSession()

    return () => {
      disposeSession(sessionClosure?.id)
      ignore = true
    }
  }, [createSession, disposeSession, key, retry, scope])

  React.useEffect(() => {
    if (!session) return
    // Refresh when it 20% of time to session end
    const delay = (session.expires.getTime() - Date.now()) * 0.8
    const timer = setTimeout(async () => {
      try {
        const s = await refreshSession(session.id, SESSION_TTL)
        setSession(s)
      } catch (e) {
        if (/Session [^ ]* not found/.test((e as Record<'message', string>)?.message)) {
          setError(PreviewError.Expired({ retry }))
        } else {
          setError(PreviewError.Unexpected({ retry }))
        }
        log.error(e)
      }
    }, delay)
    return () => clearTimeout(timer)
  }, [refreshSession, retry, session])

  if (error) return AsyncResult.Err(error)
  if (loading) return AsyncResult.Pending()
  return AsyncResult.Ok(session)
}

export default function BrowsableLoader({ handle, children }: BrowsableLoaderProps) {
  const sessionData = useSession(handle)
  return children(
    AsyncResult.case(
      {
        Ok: (s: Session) =>
          AsyncResult.Ok(
            PreviewData.IFrame({
              src: `${cfg.s3Proxy}/browse/${s?.id}/${handle.logicalKey}`,
              modes: [FileType.Html, FileType.Text],
            }),
          ),
        Err: AsyncResult.Err,
        Pending: AsyncResult.Pending,
        _: R.identity,
      },
      sessionData,
    ),
  )
}
