import type * as React from 'react'

import type * as Model from 'model'
import AsyncResult from 'utils/AsyncResult'

import { PreviewError } from '../types'

export const detect = () => true

interface FallbackLoaderProps {
  children: (result: $TSFixMe) => React.ReactNode
  handle: Model.S3.S3ObjectLocation
}

export const Loader = function FallbackLoader({ handle, children }: FallbackLoaderProps) {
  return children(AsyncResult.Err(PreviewError.Unsupported({ handle })))
}
