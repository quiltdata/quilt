import * as React from 'react'

import cfg from 'constants/config'
import type * as Model from 'model'
import * as AWS from 'utils/AWS'
import AsyncResult from 'utils/AsyncResult'

import { PreviewData } from '../types'

import * as utils from './utils'

export const detect = utils.extIn(['.m2t', '.m2ts', '.mp4', '.webm'])

interface VideoLoaderProps {
  children: (result: $TSFixMe) => React.ReactNode
  handle: Model.S3.S3ObjectLocation
}

function useVideoSrc(handle: Model.S3.S3ObjectLocation): string {
  const sign = AWS.Signer.useS3Signer()
  const url = React.useMemo(() => sign(handle), [handle, sign])
  const query = new URLSearchParams({ format: 'video/webm', url })
  return `${cfg.apiGatewayEndpoint}/transcode?${query.toString()}`
}

export const Loader = function VideoLoader({ handle, children }: VideoLoaderProps) {
  const src = useVideoSrc(handle)
  return children(AsyncResult.Ok(PreviewData.Video({ src })))
}
