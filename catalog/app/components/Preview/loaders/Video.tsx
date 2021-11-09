import AsyncResult from 'utils/AsyncResult'
import type { S3HandleBase } from 'utils/s3paths'

import { PreviewData } from '../types'

import * as utils from './utils'

export const detect = utils.extIn(['.mp4'])

interface VideoLoaderProps {
  handle: S3HandleBase
  children: (result: $TSFixMe) => React.ReactNode
}

export const Loader = function VideoLoader({ handle, children }: VideoLoaderProps) {
  return children(AsyncResult.Ok(PreviewData.Video({ handle })))
}
