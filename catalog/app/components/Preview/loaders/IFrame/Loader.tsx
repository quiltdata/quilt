import * as React from 'react'

import * as AWS from 'utils/AWS'
import AsyncResult from 'utils/AsyncResult'
import * as s3paths from 'utils/s3paths'

import { PreviewData } from '../../types'

interface IFrameLoaderProps {
  children: (result: $TSFixMe) => React.ReactNode
  handle: s3paths.S3HandleBase
}

export default function IFrameLoader({ handle, children }: IFrameLoaderProps) {
  const sign = AWS.Signer.useS3Signer()
  const src = React.useMemo(
    () => sign(handle, { ResponseContentType: 'text/html' }),
    [handle, sign],
  )
  return children(AsyncResult.Ok(PreviewData.IFrame({ src })))
}
