import * as React from 'react'
import * as AWS from 'utils/AWS'
import AsyncResult from 'utils/AsyncResult'
import { useIsInStack } from 'utils/BucketConfig'

import { PreviewData } from '../types'

import * as Text from './Text'
import * as utils from './utils'

export const detect = utils.extIn(['.htm', '.html'])

const IFrameLoader = ({ handle, children }) => {
  const sign = AWS.Signer.useS3Signer()
  const src = React.useMemo(() => sign(handle, { ResponseContentType: 'text/html' }), [
    handle.bucket,
    handle.key,
    handle.version,
    sign,
  ])
  return children(AsyncResult.Ok(AsyncResult.Ok(PreviewData.IFrame({ src }))))
}

const HtmlLoader = ({ handle, children }) => {
  const isInStack = useIsInStack()
  return isInStack(handle.bucket) ? (
    <IFrameLoader handle={handle}>{children}</IFrameLoader>
  ) : (
    Text.load(handle, children)
  )
}

export const load = (handle, callback) => (
  <HtmlLoader handle={handle}>{callback}</HtmlLoader>
)
