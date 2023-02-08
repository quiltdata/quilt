import * as React from 'react'
import * as urql from 'urql'

import cfg from 'constants/config'
import AsyncResult from 'utils/AsyncResult'
import log from 'utils/Logging'
import * as LogicalKeyResolver from 'utils/LogicalKeyResolver'
import * as PackageUri from 'utils/PackageUri'
import assertNever from 'utils/assertNever'
import type { PackageHandle } from 'utils/packageHandle'
import usePolling from 'utils/usePolling'

import { PreviewData } from '../../types'

import FileType from '../fileType'

import CREATE_BROWSING_SESSION from '../CreateBrowsingSession.generated'

interface FileHandle extends LogicalKeyResolver.S3SummarizeHandle {
  logicalKey: string
  packageHandle: PackageHandle
}

interface IFrameLoaderProps {
  children: (result: $TSFixMe) => React.ReactNode
  handle: FileHandle
}

function useSessionId(handle: FileHandle) {
  const [sessionId, setSessionId] = React.useState<string | null>(null)
  const [, createSession] = urql.useMutation(CREATE_BROWSING_SESSION)
  const scope = PackageUri.stringify(handle.packageHandle)
  React.useEffect(() => {
    let ignore = false
    // on mount: mutation: create browsing session
    createSession({ scope, ttl: 60 * 60 })
      .then(async (res) => {
        if (ignore) return
        if (res.error) throw res.error
        if (!res.data) throw new Error('No data')
        const r = res.data.browsingSessionCreate
        switch (r.__typename) {
          case 'BrowsingSession':
            setSessionId(r.id)
            return
          default:
            return assertNever(r as never)
        }
      })
      .catch((e) => {
        log.error(e)
      })

    return () => {
      // TODO: dispose
      ignore = true
    }
  }, [scope, createSession])
  return sessionId
}

function useKeepAlive(sessionId: string | null) {
  usePolling(() => {
    if (!sessionId) return
    console.log('Refresh session', sessionId)
  }, 5)
}

export default function ExtendedFrameLoader({ handle, children }: IFrameLoaderProps) {
  const sessionId = useSessionId(handle)
  useKeepAlive(sessionId)
  if (!sessionId) return children(AsyncResult.Pending())

  const src = `${cfg.s3Proxy}/browse/${sessionId}/${handle.logicalKey}`

  return children(
    AsyncResult.Ok(PreviewData.IFrame({ src, modes: [FileType.Html, FileType.Text] })),
  )
}
