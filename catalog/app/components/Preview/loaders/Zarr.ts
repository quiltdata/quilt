import * as React from 'react'

import type * as Model from 'model'
import AsyncResult from 'utils/AsyncResult'

import { PreviewData } from '../types'

// The root metadata file of an OME-Zarr store: Zarr v2 `.zattrs` or Zarr v3 `zarr.json`
// directly inside a `*.zarr` directory.
const ROOT_METADATA_RE = /\.zarr\/(\.zattrs|zarr\.json)$/i

export const detect = (key: string) => ROOT_METADATA_RE.test(key)

interface ZarrLoaderProps {
  children: (result: $TSFixMe) => React.ReactNode
  handle: Model.S3.S3ObjectLocation
}

export const Loader = function ZarrLoader({ handle, children }: ZarrLoaderProps) {
  return children(AsyncResult.Ok(PreviewData.Zarr({ handle })))
}
