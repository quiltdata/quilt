import * as R from 'ramda'

import { PreviewData } from '../types'
import * as utils from './utils'

export const detect = R.pipe(utils.stripCompression, utils.extIn(['.xls', '.xlsx']))

export const Loader = function ExcelLoader({ handle, children }) {
  const data = utils.usePreview({ type: 'excel', handle })
  const processed = utils.useProcessing(data.result, (json) =>
    PreviewData.DataFrame({
      preview: json.html,
      note: json.info.note,
      warnings: json.info.warnings,
    }),
  )
  return children(utils.useErrorHandling(processed, { handle, retry: data.fetch }))
}
