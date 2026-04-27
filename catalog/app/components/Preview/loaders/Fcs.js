import * as R from 'ramda'

import { PreviewData } from '../types'
import * as utils from './utils'

export const detect = R.pipe(utils.stripCompression, utils.extIs('.fcs'))

export const Loader = function FcsLoader({ handle, children }) {
  const data = utils.usePreview({ type: 'fcs', handle })
  const processed = utils.useProcessing(data.result, ({ html, info }) =>
    PreviewData.Fcs({
      preview: html,
      metadata: info.metadata,
      note: info.note,
      warnings: info.warnings,
    }),
  )
  return children(utils.useErrorHandling(processed, { handle, retry: data.fetch }))
}
