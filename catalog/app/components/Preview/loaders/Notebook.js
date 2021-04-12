import * as R from 'ramda'
import * as React from 'react'

import * as Html from './Html'
import { PreviewData } from '../types'
import * as utils from './utils'

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

function VoilaLoader({ handle, children }) {
  // FIXME: make a Voila service request and preview html as iframe
  //        <iframe src="https://api/voila.html" />
  const voilaHandle = R.assoc('key', `${handle.key}.html`, handle)
  return <Html.Loader {...{ handle: voilaHandle, children }} />
}

export const Loader = function WrappedNotebookLoader({ handle, children }) {
  return handle.mode === 'voila' ? (
    <VoilaLoader {...{ handle, children }} />
  ) : (
    <NotebookLoader {...{ handle, children }} />
  )
}
