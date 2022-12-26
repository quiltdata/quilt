import * as React from 'react'

import cfg from 'constants/config'
import * as AWS from 'utils/AWS'
import AsyncResult from 'utils/AsyncResult'
import { useIsInStack } from 'utils/BucketConfig'
import { useStatusReportsBucket } from 'utils/StatusReportsBucket'
import useMemoEq from 'utils/useMemoEq'

import { PreviewData } from '../types'

import * as Text from './Text'
import FileType from './fileType'
import * as utils from './utils'

export const detect = utils.extIn(['.htm', '.html'])

export const FILE_TYPE = FileType.Html

function IFrameLoader({ handle, children }) {
  const sign = AWS.Signer.useS3Signer()
  const src = useMemoEq([handle, sign], () =>
    sign(handle, { ResponseContentType: 'text/html' }),
  )
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
