import * as React from 'react'

import * as AWS from 'utils/AWS'
import AsyncResult from 'utils/AsyncResult'
import * as Config from 'utils/Config'
import type { S3HandleBase } from 'utils/s3paths'

import { PreviewData } from '../types'

import * as utils from './utils'

export const detect = utils.extIn(['.flac', '.mp3', '.ogg', '.ts', '.tsa', '.wav'])

interface AudioLoaderProps {
  children: (result: $TSFixMe) => React.ReactNode
  handle: S3HandleBase
}

function useAudioSrc(handle: S3HandleBase): string {
  const { binaryApiGatewayEndpoint: endpoint } = Config.use()
  const sign = AWS.Signer.useS3Signer()
  const url = React.useMemo(() => sign(handle), [handle, sign])
  const query = new URLSearchParams({
    format: 'audio/mpeg',
    url,
  })
  return `${endpoint}/transcode?${query.toString()}`
}

export const Loader = function AudioLoader({ handle, children }: AudioLoaderProps) {
  const src = useAudioSrc(handle)
  return children(AsyncResult.Ok(PreviewData.Audio({ src })))
}
