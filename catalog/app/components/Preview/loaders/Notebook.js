import * as R from 'ramda'
import * as React from 'react'

import * as AWS from 'utils/AWS'
import AsyncResult from 'utils/AsyncResult'
import * as Config from 'utils/Config'

import { PreviewData } from '../types'
import * as utils from './utils'
import * as Json from './Json'

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
  const sign = AWS.Signer.useS3Signer()

  const base = `${Config.useConfig().registryUrl}/voila/voila/render`
  const url = encodeURIComponent(sign(handle))
  const src = `${base}/?url=${url}`

  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    const link = document.createElement('iframe')
    link.addEventListener('load', () => setLoading(false))
    link.src = src
    link.style.display = 'none'
    document.body.appendChild(link)
  }, [src, setLoading])

  return children(
    loading ? AsyncResult.Pending() : AsyncResult.Ok(PreviewData.IFrame({ src })),
  )
}

export const Loader = function WrappedNotebookLoader({ handle, children }) {
  switch (handle.mode) {
    case 'voila':
      return <VoilaLoader {...{ handle, children }} />
    case 'json':
      return <Json.Loader {...{ handle, children }} />
    default:
      return <NotebookLoader {...{ handle, children }} />
  }
}
