import * as React from 'react'
import * as AWS from 'utils/AWS'
import AsyncResult from 'utils/AsyncResult'
import { useIsInStack } from 'utils/BucketConfig'
import useMemoEq from 'utils/useMemoEq'

import { PreviewData } from '../types'

import * as Text from './Text'
import * as utils from './utils'

export const detect = utils.extIn(['.htm', '.html'])

function IFrameLoader({ handle, children }) {
  const sign = AWS.Signer.useS3Signer()
  const src = useMemoEq([handle, sign], () =>
    sign(handle, { ResponseContentType: 'text/html' }),
  )
  // TODO: issue a head request to ensure existence and get storage class
  return children(AsyncResult.Ok(PreviewData.IFrame({ src })))
}

export const Loader = function HtmlLoader({ handle, children }) {
  const isInStack = useIsInStack()
  return isInStack(handle.bucket) ? (
    <IFrameLoader {...{ handle, children }} />
  ) : (
    <Text.Loader {...{ handle, children }} />
  )
}
