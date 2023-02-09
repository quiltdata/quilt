import * as React from 'react'

import cfg from 'constants/config'
import AsyncResult from 'utils/AsyncResult'
import { useIsInStack } from 'utils/BucketConfig'
import { useStatusReportsBucket } from 'utils/StatusReportsBucket'
import useQuery from 'utils/useQuery'

import * as Text from './Text'
import * as IFrame from './IFrame'
import FileType from './fileType'
import * as utils from './utils'

import BUCKET_CONFIG_QUERY from './IFrame/BrowsableBucketConfig.generated'

export const detect = utils.extIn(['.htm', '.html'])

export const FILE_TYPE = FileType.Html

export const Loader = function HtmlLoader({ handle, children }) {
  const isInStack = useIsInStack()
  const statusReportsBucket = useStatusReportsBucket()
  const bucketData = useQuery({
    query: BUCKET_CONFIG_QUERY,
    variables: { bucket: handle.bucket },
  })
  return bucketData.case({
    fetching: () => children(AsyncResult.Pending()),
    error: (e) => children(AsyncResult.Err(e)),
    data: ({ bucketConfig: { browsable } }) => {
      if (browsable) return <IFrame.ExtendedLoader {...{ handle, children }} />
      if (
        cfg.mode === 'LOCAL' ||
        isInStack(handle.bucket) ||
        handle.bucket === statusReportsBucket
      ) {
        return <IFrame.Loader {...{ handle, children }} />
      }
      return <Text.Loader {...{ handle, children }} />
    },
  })
}
