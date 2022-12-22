import { extname } from 'path'

import type { PromiseResult } from 'aws-sdk/lib/request'
import * as R from 'ramda'
import * as React from 'react'
import { DecompressorRegistry } from 'ngl'

import type { S3HandleBase } from 'utils/s3paths'

import { PreviewData } from '../types'

import * as mol from './formatters/mol'
import * as modes from './modes'
import * as utils from './utils'

type ResponseFile = string | Uint8Array

export const MODE = modes.Ngl

export async function parseResponse(
  file: ResponseFile,
  handle: S3HandleBase,
): Promise<{ file: ResponseFile; ext: string; meta?: mol.MolMeta }[]> {
  const ext = extname(utils.stripCompression(handle.key)).substring(1)
  switch (ext) {
    case 'sdf':
    case 'mol':
    case 'mol2':
      return mol.parse(file, ext)
    default:
      return [
        {
          ext,
          file,
        },
      ]
  }
}

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
  const processed = utils.useAsyncProcessing(
    data.result,
    async (r: PromiseResult<{ Body: ResponseFile }, null>) => {
      const compression = utils.getCompression(handle.key)
      const body = compression === 'gz' ? gzipDecompress(r.Body as string) : r.Body
      const files = await parseResponse(body, handle)
      return PreviewData.Ngl({
        files: files.map(({ file, ...rest }) => ({ blob: new Blob([file]), ...rest })),
        modes: [modes.Ngl, modes.Text],
      })
    },
  )
  const handled = utils.useErrorHandling(processed, { handle, retry: data.fetch })
  return children(handled)
}
