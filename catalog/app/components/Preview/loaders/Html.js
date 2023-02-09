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

function useSwitchLoader(handle) {
  const variables = React.useMemo(() => ({ bucket: handle.bucket }), [handle])
  const isInStack = useIsInStack()
  const statusReportsBucket = useStatusReportsBucket()
  const bucketData = useQuery({
    query: BUCKET_CONFIG_QUERY,
    variables,
  })
  return bucketData.case({
    fetching: AsyncResult.Pending,
    error: AsyncResult.Err,
    data: ({ bucketConfig: { browsable } }) => {
      if (browsable) return AsyncResult.Ok(IFrame.ExtendedLoader)
      if (
        cfg.mode === 'LOCAL' ||
        isInStack(handle.bucket) ||
        handle.bucket === statusReportsBucket
      ) {
        return AsyncResult.Ok(IFrame.Loader)
      }
      return AsyncResult.Ok(Text.Loader)
    },
  })
}

export const Loader = function HtmlLoader({ handle, children }) {
  const loaderData = useSwitchLoader(handle)
  return AsyncResult.case(
    {
      Pending: () => children(AsyncResult.Pending()),
      Err: (e) => children(AsyncResult.Err(e)),
      Ok: (SelectedLoader) => <SelectedLoader {...{ handle, children }} />,
      _: () => null,
    },
    loaderData,
  )
}
