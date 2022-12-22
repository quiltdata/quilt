import * as React from 'react'
import * as AWS from 'utils/AWS'
import AsyncResult from 'utils/AsyncResult'
import * as Config from 'utils/Config'
import { useIsInStack } from 'utils/BucketConfig'
import { useStatusReportsBucket } from 'utils/StatusReportsBucket'
import useMemoEq from 'utils/useMemoEq'

import { PreviewData } from '../types'

import * as Text from './Text'
import * as modes from './modes'
import * as utils from './utils'

export const detect = utils.extIn(['.htm', '.html'])

export const MODE = modes.Html

function IFrameLoader({ handle, children }) {
  const sign = AWS.Signer.useS3Signer()
  const src = useMemoEq([handle, sign], () =>
    sign(handle, { ResponseContentType: 'text/html' }),
  )
  // TODO: issue a head request to ensure existence and get storage class
  return children(
    AsyncResult.Ok(PreviewData.IFrame({ src, modes: [modes.Html, modes.Text] })),
  )
}

export const Loader = function HtmlLoader({ handle, children }) {
  const isInStack = useIsInStack()
  const { mode } = Config.use()
  const statusReportsBucket = useStatusReportsBucket()
  return mode === 'LOCAL' ||
    isInStack(handle.bucket) ||
    handle.bucket === statusReportsBucket ? (
    <IFrameLoader {...{ handle, children }} />
  ) : (
    <Text.Loader {...{ handle, children }} />
  )
}
