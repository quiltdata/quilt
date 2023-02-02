import * as React from 'react'
import * as urql from 'urql'

import cfg from 'constants/config'
import AsyncResult from 'utils/AsyncResult'
import { useIsInStack } from 'utils/BucketConfig'
import * as PackageUri from 'utils/PackageUri'
import { useStatusReportsBucket } from 'utils/StatusReportsBucket'

import { PreviewData } from '../types'

import * as Text from './Text'
import FileType from './fileType'
import * as utils from './utils'

export const detect = utils.extIn(['.htm', '.html'])

export const FILE_TYPE = FileType.Html

import CREATE_BROWSING_SESSION from './CreateBrowsingSession.generated'

// TODO: enforce ResponseContentType: 'text/html' somewhere?
function IFrameLoader({ handle, children }) {
  const [, createSession] = urql.useMutation(CREATE_BROWSING_SESSION)
  const [sessionId, setSessionId] = React.useState(null)

  console.log('iframe loader', { handle })
  const scope = PackageUri.stringify(handle.packageHandle)
  // TODO: while mounted: refresh
  React.useEffect(() => {
    // on mount: mutation: create browsing session
    createSession({ scope, ttl: 60 * 60 })
      .then(async (res) => {
        if (res.error) throw res.error
        if (!res.data) throw new Error('No data')
        const r = res.data.browsingSessionCreate
        console.log('browsing session created:', r)
        switch (r.__typename) {
          case 'BrowsingSession':
            setSessionId(r.id)
            return
          default:
            return assertNever(r)
        }
      })
      .catch((e) => {
        console.error(e)
      })

    return async () => {
      // on unmount: dispose
    }
  }, [scope, createSession])

  if (!sessionId) return children(AsyncResult.Pending())

  const src = `${cfg.s3Proxy}/browse/${sessionId}/${handle.logicalKey}`
  // TODO: issue a head request to ensure existence and get storage class
  return children(
    AsyncResult.Ok(PreviewData.IFrame({ src, modes: [FileType.Html, FileType.Text] })),
  )
}

export const Loader = function HtmlLoader({ handle, children }) {
  const isInStack = useIsInStack()
  const statusReportsBucket = useStatusReportsBucket()
  return cfg.mode === 'LOCAL' ||
    isInStack(handle.bucket) ||
    handle.bucket === statusReportsBucket ? (
    <IFrameLoader {...{ handle, children }} />
  ) : (
    <Text.Loader {...{ handle, children }} />
  )
}
