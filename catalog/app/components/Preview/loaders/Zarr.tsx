import * as React from 'react'

import type * as Model from 'model'
import AsyncResult from 'utils/AsyncResult'

import { CONTEXT, PreviewData } from '../types'

import FileType from './fileType'
import * as Json from './Json'
import * as utils from './utils'
import { isImage } from './zarrDetect'

export { detect } from './zarrDetect'

// A view mode only: not a quilt_summarize type, so no FILE_TYPE.
export const MODES = [FileType.Zarr]

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
        children(
          AsyncResult.Ok(
            PreviewData.Zarr({
              handle,
              // Listings can hold many stores; each viewer is a WebGL context and a
              // tile stream, and browsers cap live contexts at about 16.
              deferred: options?.context === CONTEXT.LISTING,
              modes: [FileType.Zarr, FileType.Json, FileType.Text],
            }),
          ),
        )
      ) : (
        <Json.Loader {...{ handle, children, options }} />
      ),
    _: children,
  })
}
