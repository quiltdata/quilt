import * as R from 'ramda'
import * as React from 'react'

import * as AWS from 'utils/AWS'
import * as Data from 'utils/Data'
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

function waitForIframe(src) {
  return new Promise((resolve) => {
    const link = document.createElement('iframe')
    link.addEventListener('load', (event) => {
      resolve(event.target)
    })
    link.src = src
    link.style.display = 'none'

    document.body.appendChild(link)

    const iframeDocument = link.contentWindow || link.contentDocuent
    if (iframeDocument) {
      iframeDocument.addEventListener('error', (error) => {
        // eslint-disable-next-line no-console
        console.error(error)
      })
    }
  })
}

async function loadVoila({ endpoint, sign, handle }) {
  const base = `${endpoint}/voila/voila/render`
  const url = encodeURIComponent(sign(handle))
  const src = `${base}/?url=${url}`

  await waitForIframe(src)
  return PreviewData.IFrame({ src, sandbox: null })
}

function VoilaLoader({ handle, children }) {
  const sign = AWS.Signer.useS3Signer()
  const endpoint = Config.use().registryUrl
  const data = Data.use(loadVoila, { endpoint, sign, handle })
  return children(utils.useErrorHandling(data.result, { handle, retry: data.fetch }))
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
