import * as React from 'react'

import type { S3HandleBase } from 'utils/s3paths'

import { PreviewData, PreviewError } from '../types'

import * as utils from './utils'

export const detect = utils.extIn(['.pdb', '.cif'])

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
        const blob = new Blob([r.Body])
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
