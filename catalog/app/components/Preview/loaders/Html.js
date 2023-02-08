import * as React from 'react'

import { useIsInStack } from 'utils/BucketConfig'
import { useStatusReportsBucket } from 'utils/StatusReportsBucket'
import * as Text from './Text'
import * as IFrame from './IFrame'
import FileType from './fileType'
import * as utils from './utils'

export const detect = utils.extIn(['.htm', '.html'])

function useIsJsEnabled() {
  return true
}

export const FILE_TYPE = FileType.Html

export const Loader = function HtmlLoader({ handle, children }) {
  const isJsEnabled = useIsJsEnabled()
  const isInStack = useIsInStack()
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
