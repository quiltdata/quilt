import * as React from 'react'
import * as urql from 'urql'

import cfg from 'constants/config'
import * as Model from 'model'
import AsyncResult from 'utils/AsyncResult'
import log from 'utils/Logging'
import * as LogicalKeyResolver from 'utils/LogicalKeyResolver'
import * as PackageUri from 'utils/PackageUri'
import assertNever from 'utils/assertNever'
import type { PackageHandle } from 'utils/packageHandle'

import { PreviewData } from '../../types'

import FileType from '../fileType'

import CREATE_BROWSING_SESSION from './CreateBrowsingSession.generated'
import REFRESH_BROWSING_SESSION from './RefreshBrowsingSession.generated'
import DISPOSE_BROWSING_SESSION from './DisposeBrowsingSession.generated'

const SESSION_TTL = 60

type Session = Model.GQLTypes.BrowsingSession

interface FileHandle extends LogicalKeyResolver.S3SummarizeHandle {
  logicalKey: string
  packageHandle: PackageHandle
}

interface IFrameLoaderProps {
  children: (result: $TSFixMe) => React.ReactNode
  handle: FileHandle
}

function useSession(handle: FileHandle): [Error | null, Session | null] {
  const [error, setError] = React.useState<Error | null>(null)
  const [session, setSession] = React.useState<Session | null>(null)
  const [, createSession] = urql.useMutation(CREATE_BROWSING_SESSION)
  const [, disposeSession] = urql.useMutation(DISPOSE_BROWSING_SESSION)
  const [, refreshSession] = urql.useMutation(REFRESH_BROWSING_SESSION)
  const scope = PackageUri.stringify(handle.packageHandle)
  React.useEffect(() => {
    let ignore = false
    let sessionClosure: Session | null = null
    createSession({ scope, ttl: SESSION_TTL })
      .then((res) => {
        if (ignore) return
        if (res.error) throw res.error
        if (!res.data) throw new Error('No data')
        const r = res.data.browsingSessionCreate
        switch (r.__typename) {
          case 'BrowsingSession':
            sessionClosure = r
            setSession(r)
            return
          default:
            return assertNever(r as never)
        }
      })
      .catch((e) => {
        if (e instanceof Error) setError(e)
        log.error(e)
      })

    return () => {
      if (sessionClosure?.id) {
        disposeSession({ id: sessionClosure?.id })
      }
      ignore = true
    }
  }, [createSession, disposeSession, scope])

  React.useEffect(() => {
    if (!session) return
    const expiresAt = session.expires.getTime()
    const delay = (expiresAt - Date.now()) / 3
    setTimeout(async () => {
      try {
        const res = await refreshSession({ id: session.id, ttl: 180 })
        if (res.error) throw res.error
        if (!res.data) throw new Error('No data')
        const r = res.data.browsingSessionRefresh
        switch (r.__typename) {
          case 'BrowsingSession':
            setSession(r)
            return
          default:
            return assertNever(r as never)
        }
      } catch (e) {
        if (e instanceof Error) setError(e)
        log.error(e)
      }
    }, delay)
  }, [refreshSession, session])

  return [error, session]
}

export default function ExtendedFrameLoader({ handle, children }: IFrameLoaderProps) {
  const [error, session] = useSession(handle)

  if (error) return children(AsyncResult.Err(error))
  if (!session?.id) return children(AsyncResult.Pending())

  const src = `${cfg.s3Proxy}/browse/${session.id}/${handle.logicalKey}`

  return children(
    AsyncResult.Ok(PreviewData.IFrame({ src, modes: [FileType.Html, FileType.Text] })),
  )
}
