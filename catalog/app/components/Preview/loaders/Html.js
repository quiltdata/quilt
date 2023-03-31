import * as React from 'react'

import cfg from 'constants/config'
import AsyncResult from 'utils/AsyncResult'
import { useIsInStack } from 'utils/BucketConfig'
import * as GQL from 'utils/GraphQL'
import { useStatusReportsBucket } from 'utils/StatusReportsBucket'

import * as IFrame from './IFrame'
import * as Text from './Text'
import FileType from './fileType'
import * as utils from './utils'

import BUCKET_CONFIG_QUERY from './IFrame/BrowsableBucketConfig.generated'

export const detect = utils.extIn(['.htm', '.html'])

export const FILE_TYPE = FileType.Html

function IFrameLoader({ handle, children }) {
  const bucketData = GQL.useQuery(BUCKET_CONFIG_QUERY, { bucket: handle.bucket })
  const inPackage = !!handle.packageHandle
  return GQL.fold(bucketData, {
    fetching: () => children(AsyncResult.Pending()),
    error: (e) => children(AsyncResult.Err(e)),
    data: ({ bucketConfig: { browsable } }) =>
      browsable && inPackage ? (
        <IFrame.LoaderBrowsable {...{ handle, children }} />
      ) : (
        <IFrame.LoaderSigned {...{ handle, children }} />
      ),
  })
}

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
  return useHtmlAsText(handle) ? (
    <Text.Loader {...{ handle, children }} />
  ) : (
    <IFrameLoader {...{ handle, children }} />
  )
}
