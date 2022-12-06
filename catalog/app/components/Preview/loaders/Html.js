import * as React from 'react'

import * as Config from 'utils/Config'
import { useBucketConfig, useCurrentBucket, useIsInStack } from 'utils/BucketConfig'
import { useStatusReportsBucket } from 'utils/StatusReportsBucket'

import * as Text from './Text'
import * as IFrame from './IFrame'
import * as utils from './utils'

export const detect = utils.extIn(['.htm', '.html'])

function useIsJsEnabled(handle) {
  const bucket = useCurrentBucket()
  const currentBucket = useBucketConfig(bucket)
  const handleBucket = useBucketConfig(handle.bucket)
  return currentBucket.tags.includes('quilt-js') && handleBucket.tags.includes('quilt-js')
}

export const Loader = function HtmlLoader({ handle, children }) {
  const isJsEnabled = useIsJsEnabled(handle)
  const isInStack = useIsInStack()
  const { mode } = Config.use()
  const statusReportsBucket = useStatusReportsBucket()

  if (isJsEnabled) {
    return <IFrame.ExtendedLoader {...{ handle, children }} />
  }
  if (
    mode === 'LOCAL' ||
    isInStack(handle.bucket) ||
    handle.bucket === statusReportsBucket
  ) {
    return <IFrame.Loader {...{ handle, children }} />
  }
  return <Text.Loader {...{ handle, children }} />
}
