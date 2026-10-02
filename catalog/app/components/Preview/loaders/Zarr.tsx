import * as React from 'react'

import type * as Model from 'model'
import AsyncResult from 'utils/AsyncResult'

import { PreviewData } from '../types'

import * as Json from './Json'
import * as utils from './utils'
import { isImage } from './zarrDetect'

export { detect } from './zarrDetect'

const BYTES_TO_SCAN = 128 * 1024

interface ZarrLoaderProps {
  children: (result: $TSFixMe) => React.ReactNode
  handle: Model.S3.S3ObjectLocation
  options: $TSFixMe
}

export const Loader = function ZarrLoader({
  handle,
  children,
  options,
}: ZarrLoaderProps) {
  return utils.useFirstBytes({ bytes: BYTES_TO_SCAN, handle }).case({
    Ok: ({ firstBytes }: { firstBytes: string }) =>
      isImage(firstBytes) ? (
        children(AsyncResult.Ok(PreviewData.Zarr({ handle })))
      ) : (
        <Json.Loader {...{ handle, children, options }} />
      ),
    _: children,
  })
}
