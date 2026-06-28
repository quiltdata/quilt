import * as R from 'ramda'
import * as React from 'react'

import { S3SummarizeHandle } from 'utils/LogicalKeyResolver'

import { PreviewData } from '../types'
import * as utils from './utils'

export const detect = R.pipe(utils.stripCompression, utils.extIs('.vcf'))

interface VcfLoaderProps {
  children: (result: $TSFixMe) => React.ReactNode
  handle: S3SummarizeHandle
}

interface PreviewResult {
  info: {
    data: {
      meta: string[]
      header: string[][]
      data: string[][]
    }
    metadata: {
      variants: string[]
    }
    note?: string
    warnings?: string
  }
}

export const Loader = function VcfLoader({ handle, children }: VcfLoaderProps) {
  const { result, fetch } = utils.usePreview({ type: 'vcf', handle })
  const processed = utils.useProcessing(
    result,
    ({
      info: {
        data: { meta, header, data },
        metadata: { variants },
        note,
        warnings,
      },
    }: PreviewResult) =>
      PreviewData.Vcf({ meta, header, data, variants, note, warnings }),
  )
  return children(utils.useErrorHandling(processed, { handle, retry: fetch }))
}
