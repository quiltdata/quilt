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

import { PreviewData } from '../../types'

import FileType from '../fileType'

import CREATE_BROWSING_SESSION from './CreateBrowsingSession.generated'
import DISPOSE_BROWSING_SESSION from './DisposeBrowsingSession.generated'
import REFRESH_BROWSING_SESSION from './RefreshBrowsingSession.generated'

const SESSION_TTL = 60

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

interface FileHandle extends LogicalKeyResolver.S3SummarizeHandle {
  logicalKey: string
  packageHandle: PackageHandle
}

interface IFrameLoaderProps {
  children: (result: $TSFixMe) => React.ReactNode
  handle: FileHandle
}

function useSession(handle: FileHandle) {
  const [error, setError] = React.useState<Error | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [session, setSession] = React.useState<Session | null>(null)

  const createSession = useCreateSession()
  const refreshSession = useRefreshSession()

  const [, disposeSession] = urql.useMutation(DISPOSE_BROWSING_SESSION)

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
        if (e instanceof Error) setError(e)
        log.error(e)
      }
      setLoading(false)
    }

    requestSession()

    return () => {
      if (sessionClosure?.id) {
        disposeSession({ id: sessionClosure?.id })
      }
      ignore = true
    }
  }, [createSession, disposeSession, scope])

  React.useEffect(() => {
    if (!session) return
    const delay = (session.expires.getTime() - Date.now()) / 4
    setTimeout(async () => {
      try {
        const s = await refreshSession(session.id, SESSION_TTL)
        setSession(s)
      } catch (e) {
        if (e instanceof Error) setError(e)
        log.error(e)
      }
    }, delay)
  }, [refreshSession, session])

  if (error) return AsyncResult.Err(error)
  if (loading) return AsyncResult.Pending()
  return AsyncResult.Ok(session)
}

export default function ExtendedFrameLoader({ handle, children }: IFrameLoaderProps) {
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
