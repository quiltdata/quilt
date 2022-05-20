import { extname } from 'path'

import type { PromiseResult } from 'aws-sdk/lib/request'
import * as R from 'ramda'
import * as React from 'react'
import { DecompressorRegistry } from 'ngl'

import type { S3HandleBase } from 'utils/s3paths'

import { PreviewData } from '../types'

import * as utils from './utils'

export const detect = R.pipe(
  utils.stripCompression,
  utils.extIn(['.cif', '.ent', '.mol', '.mol2', '.pdb', '.sdf']),
)

const gzipDecompress = DecompressorRegistry.get('gz')

interface NglLoaderProps {
  children: (result: $TSFixMe) => React.ReactNode
  handle: S3HandleBase
}

export const Loader = function NglLoader({ handle, children }: NglLoaderProps) {
  const data = utils.useObjectGetter(handle)
  const processed = utils.useProcessing(
    data.result,
    (r: PromiseResult<{ Body: Uint8Array | string }, null>) => {
      const compression = utils.getCompression(handle.key)
      const body = compression === 'gz' ? gzipDecompress(r.Body as string) : r.Body
      const ext = extname(utils.stripCompression(handle.key)).substring(1)
      return PreviewData.Ngl({ blob: new Blob([body]), ext })
    },
  )
  const handled = utils.useErrorHandling(processed, { handle, retry: data.fetch })
  return children(handled)
}
