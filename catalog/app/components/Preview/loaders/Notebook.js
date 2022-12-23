import * as R from 'ramda'
import * as React from 'react'

import { useVoila } from 'utils/voila'

import { PreviewData } from '../types'
import FileType from './fileType'
import * as utils from './utils'

export const detect = R.pipe(utils.stripCompression, utils.extIs('.ipynb'))

function NotebookLoader({ handle, children }) {
  const voilaAvailable = useVoila()
  const data = utils.usePreview({ type: 'ipynb', handle })
  const processed = utils.useProcessing(data.result, (json) =>
    PreviewData.Notebook({
      preview: json.html,
      note: json.info.note,
      warnings: json.info.warnings,
      modes:
        !!handle.packageHandle && voilaAvailable
          ? [FileType.Jupyter, FileType.Json, FileType.Voila, FileType.Text]
          : [FileType.Jupyter, FileType.Json, FileType.Text],
    }),
  )
  return children(utils.useErrorHandling(processed, { handle, retry: data.fetch }))
}

export const Loader = function WrappedNotebookLoader({ handle, children }) {
  return <NotebookLoader {...{ handle, children }} />
}
