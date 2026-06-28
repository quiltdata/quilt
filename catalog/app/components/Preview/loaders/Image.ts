import * as React from 'react'

import { SUPPORTED_EXTENSIONS } from 'components/Thumbnail'
import type * as Model from 'model'
import AsyncResult from 'utils/AsyncResult'

import { PreviewData } from '../types'

import * as utils from './utils'

export const detect = utils.extIn(SUPPORTED_EXTENSIONS)

interface ImageLoaderProps {
  children: (result: $TSFixMe) => React.ReactNode
  handle: Model.S3.S3ObjectLocation
}

export const Loader = function ImageLoader({ handle, children }: ImageLoaderProps) {
  return children(AsyncResult.Ok(PreviewData.Image({ handle })))
}
