import * as R from 'ramda'
import * as React from 'react'
import { DecompressorRegistry } from 'ngl'

import type { S3HandleBase } from 'utils/s3paths'

import { PreviewData, PreviewError } from '../types'

import * as utils from './utils'

export const detect = R.pipe(utils.stripCompression, utils.extIs('.pdb'))

const gzipDecompress = DecompressorRegistry?.get('gz')

interface NglLoaderProps {
  children: (result: $TSFixMe) => React.ReactNode
  handle: S3HandleBase
}

export const Loader = function NglLoader({ handle, children }: NglLoaderProps) {
  const data = utils.useObjectGetter(handle)
  const processed = utils.useAsyncProcessing(
    data.result,
    async (r: $TSFixMe) => {
      try {
        const compression = utils.getCompression(handle.key)
        const blob =
          compression === 'gz' ? new Blob([gzipDecompress(r.Body)]) : new Blob([r.Body])
        return PreviewData.Ngl({ blob })
      } catch (e) {
        if (e instanceof SyntaxError) {
          throw PreviewError.MalformedJson({ handle, message: e.message })
        }
        throw e
      }
    },
    [],
  )
  const handled = utils.useErrorHandling(processed, { handle, retry: fetch })
  return children(handled)
}
