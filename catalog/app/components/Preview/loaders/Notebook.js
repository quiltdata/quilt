import * as R from 'ramda'
import * as React from 'react'

import { PreviewData } from '../types'
import * as utils from './utils'
import * as Json from './Json'
import * as Voila from './Voila'

export const detect = R.pipe(utils.stripCompression, utils.extIs('.ipynb'))

function NotebookLoader({ handle, children }) {
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

export const Loader = function WrappedNotebookLoader({ handle, children }) {
  switch (handle.mode) {
    case 'voila':
      return <Voila.Loader {...{ handle, children }} />
    case 'json':
      return <Json.Loader {...{ handle, children }} />
    default:
      return <NotebookLoader {...{ handle, children }} />
  }
}
