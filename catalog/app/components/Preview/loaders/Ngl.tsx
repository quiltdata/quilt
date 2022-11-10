import { extname } from 'path'

import type { PromiseResult } from 'aws-sdk/lib/request'
import * as R from 'ramda'
import * as React from 'react'
import { DecompressorRegistry } from 'ngl'

import type { S3HandleBase } from 'utils/s3paths'

import { PreviewData } from '../types'

import * as utils from './utils'

const openchem = import('openchemlib/minimal')

type ResponseFile = string | Uint8Array

async function parseMol(
  content: string,
  ext: string,
): Promise<{ file: ResponseFile; ext: string }> {
  if (content.indexOf('V3000') === -1) return { ext, file: content }
  const { Molecule } = await openchem
  return {
    ext: 'mol',
    file: Molecule.fromMolfile(content.trim()).toMolfile(),
  }
}

export async function parseResponse(
  file: ResponseFile,
  handle: S3HandleBase,
): Promise<{ file: ResponseFile; ext: string }[]> {
  const ext = extname(utils.stripCompression(handle.key)).substring(1)
  if (ext !== 'sdf' && ext !== 'mol' && ext !== 'mol2')
    return [
      {
        ext,
        file,
      },
    ]
  return Promise.all(
    file
      .toString()
      .split('$$$$')
      .map((x) => x.trim())
      .filter(Boolean)
      .map((part) => parseMol(`${part}\n$$$$\n`, ext)),
  )
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
        files: files.map(({ file, ext }) => ({ blob: new Blob([file]), ext })),
      })
    },
  )
  const handled = utils.useErrorHandling(processed, { handle, retry: data.fetch })
  return children(handled)
}
