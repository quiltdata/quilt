import * as R from 'ramda'

import { PreviewData } from '../types'
import * as utils from './utils'

export const detect = R.pipe(utils.stripCompression, utils.extIs('.ipynb'))

export const Loader = function NotebookLoader({ handle, children }) {
  const data = utils.usePreview({ type: 'ipynb', handle })
  const processed = utils.useProcessing(data.result, (json) =>
    PreviewData.Notebook({
      preview: json.html,
      note: json.info.note,
      warnings: json.info.warnings,
    }),
  )
  return children(utils.useErrorHandling(processed, { handle, retry: data.fetch }))
}
