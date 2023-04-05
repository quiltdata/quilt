import * as React from 'react'

import cfg from 'constants/config'
import AsyncResult from 'utils/AsyncResult'
import { useIsInStack } from 'utils/BucketConfig'
import { useStatusReportsBucket } from 'utils/StatusReportsBucket'
import useQuery from 'utils/useQuery'

import * as IFrame from './IFrame'
import * as Text from './Text'
import FileType from './fileType'
import * as utils from './utils'

import BUCKET_CONFIG_QUERY from './IFrame/BrowsableBucketConfig.generated'

export const detect = utils.extIn(['.htm', '.html'])

export const FILE_TYPE = FileType.Html

// It's unsafe to render HTML in these conditions
function useHtmlAsText(handle) {
  const isInStack = useIsInStack()
  const statusReportsBucket = useStatusReportsBucket()
  return (
    cfg.mode !== 'LOCAL' &&
    !isInStack(handle.bucket) &&
    handle.bucket !== statusReportsBucket
  )
}

export const Loader = function HtmlLoader({ handle, children }) {
  const renderHtmlAsText = useHtmlAsText(handle)
  const bucketData = useQuery({
    query: BUCKET_CONFIG_QUERY,
    variables: { bucket: handle.bucket },
    pause: renderHtmlAsText,
  })
  if (renderHtmlAsText) return <Text.Loader {...{ handle, children }} />
  const inPackage = !!handle.packageHandle
  return bucketData.case({
    fetching: () => children(AsyncResult.Pending()),
    error: (e) => children(AsyncResult.Err(e)),
    data: ({ bucketConfig }) =>
      bucketConfig?.browsable && inPackage ? (
        <IFrame.LoaderBrowsable {...{ handle, children }} />
      ) : (
        <IFrame.LoaderSigned {...{ handle, children }} />
      ),
  })
}
