import * as R from 'ramda'
import type * as React from 'react'

import type * as Model from 'model'

import { PreviewData } from '../types'
import * as utils from './utils'

export const detect = R.pipe(utils.stripCompression, utils.extIs('.fcs'))

interface FcsLoaderProps {
  children: (result: $TSFixMe) => React.ReactNode
  handle: Model.S3.S3ObjectLocation
}

export const Loader = function FcsLoader({ handle, children }: FcsLoaderProps) {
  const data = utils.usePreview({ type: 'fcs', handle })
  const processed = utils.useProcessing(data.result, ({ html, info }: $TSFixMe) =>
    PreviewData.Fcs({
      preview: html,
      metadata: info.metadata,
      note: info.note,
      warnings: info.warnings,
    }),
  )
  return children(utils.useErrorHandling(processed, { handle, retry: data.fetch }))
}
