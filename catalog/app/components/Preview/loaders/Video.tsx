// import { extname } from 'path'

import * as React from 'react'

import * as AWS from 'utils/AWS'
import AsyncResult from 'utils/AsyncResult'
import type { S3HandleBase } from 'utils/s3paths'

import { PreviewData } from '../types'

import * as utils from './utils'

export const detect = utils.extIn(['.mp4', '.webm'])

interface VideoLoaderProps {
  children: (result: $TSFixMe) => React.ReactNode
  handle: S3HandleBase
}

function useVideoSrc(handle: S3HandleBase): string {
  const sign = AWS.Signer.useS3Signer()
  const url = React.useMemo(() => sign(handle), [handle, sign])
  // const requestBody = {
  //   url: url
  //   format: extname(handle.key)
  // }
  return url
}

export const Loader = function VideoLoader({ handle, children }: VideoLoaderProps) {
  const src = useVideoSrc(handle)
  return children(AsyncResult.Ok(PreviewData.Video({ src })))
}
