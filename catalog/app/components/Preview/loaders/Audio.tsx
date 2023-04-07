import * as React from 'react'

import cfg from 'constants/config'
import type * as Model from 'model'
import * as AWS from 'utils/AWS'
import AsyncResult from 'utils/AsyncResult'

import { PreviewData } from '../types'

import * as utils from './utils'

export const detect = utils.extIn(['.flac', '.mp3', '.ogg', '.ts', '.tsa', '.wav'])

interface AudioLoaderProps {
  children: (result: $TSFixMe) => React.ReactNode
  handle: Model.S3.S3ObjectLocation
}

function useAudioSrc(handle: Model.S3.S3ObjectLocation): string {
  const sign = AWS.Signer.useS3Signer()
  const url = React.useMemo(() => sign(handle), [handle, sign])
  const query = new URLSearchParams({
    duration: '30',
    format: 'audio/mpeg',
    url,
  })
  return `${cfg.apiGatewayEndpoint}/transcode?${query.toString()}`
}

export const Loader = function AudioLoader({ handle, children }: AudioLoaderProps) {
  const src = useAudioSrc(handle)
  return children(AsyncResult.Ok(PreviewData.Audio({ src })))
}
