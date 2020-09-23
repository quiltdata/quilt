import * as R from 'ramda'

import { PreviewData } from '../types'
import * as utils from './utils'

export const detect = R.pipe(utils.stripCompression, utils.extIn(['.csv', '.tsv']))

const isTsv = R.pipe(utils.stripCompression, utils.extIs('.tsv'))

export const Loader = function CsvLoader({ handle, children }) {
  const data = utils.usePreview({
    type: 'csv',
    handle,
    query: isTsv(handle.key) ? { sep: '\t' } : undefined,
  })
  const processed = utils.useProcessing(data.result, (json) =>
    PreviewData.DataFrame({
      preview: json.html,
      note: json.info.note,
      warnings: json.info.warnings,
    }),
  )
  return children(utils.useErrorHandling(processed, { handle, retry: data.fetch }))
}
