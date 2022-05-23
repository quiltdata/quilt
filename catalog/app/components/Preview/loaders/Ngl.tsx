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

async function parseFile(
  file: ResponseFile,
  handle: S3HandleBase,
): Promise<{ file: ResponseFile; ext: string }> {
  const { Molecule } = await openchem
  const ext = extname(utils.stripCompression(handle.key)).substring(1)
  if (ext !== 'sdf' && ext !== 'mol' && ext !== 'mol2')
    return {
      file,
      ext,
    }
  const strFile = file.toString()
  if (strFile.indexOf('V3000') === -1) return { file, ext }
  return {
    file: Molecule.fromMolfile(strFile).toMolfile(),
    ext: 'mol',
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
      const { file, ext } = await parseFile(body, handle)
      return PreviewData.Ngl({ blob: new Blob([file]), ext })
    },
  )
  const handled = utils.useErrorHandling(processed, { handle, retry: data.fetch })
  return children(handled)
}
