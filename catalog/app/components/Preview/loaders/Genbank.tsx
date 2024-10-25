import * as R from 'ramda'

import type * as Model from 'model'

import { PreviewData } from '../types'

import * as utils from './utils'

export const detect = R.pipe(utils.stripCompression, utils.extIs('.gb'))

interface PreviewResult {
  html: string
  info: {
    data: string
    note?: string
    warnings?: string
  }
}

interface GenbankLoaderProps {
  children: (result: $TSFixMe) => React.ReactNode
  handle: Model.S3.S3ObjectLocation
}

export const Loader = function GenbankLoader({ handle, children }: GenbankLoaderProps) {
  const data = utils.usePreview({ type: 'gb', handle, query: undefined })
  const processed = utils.useProcessing(data.result, (json: PreviewResult) =>
    PreviewData.Genbank({
      src: json.info.data,
    }),
  )
  return children(utils.useErrorHandling(processed, { handle, retry: data.fetch }))
}
