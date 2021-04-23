import * as R from 'ramda'
import * as React from 'react'

import * as AWS from 'utils/AWS'
import * as Data from 'utils/Data'
import * as Config from 'utils/Config'
import mkSearch from 'utils/mkSearch'

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

const IFRAME_SANDBOX_ATTRIBUTES = 'allow-scripts allow-same-origin'
const IFRAME_LOAD_TIMEOUT = 30000

function waitForIframe(src) {
  let resolved = false

  return new Promise((resolve, reject) => {
    const handleError = (error) => {
      document.body.removeChild(link)
      reject(error)
    }

    const handleSuccess = () => {
      resolved = true
      document.body.removeChild(link)
      resolve(src)
    }

    const timerId = setTimeout(() => {
      if (resolved) return
      handleError(new Error('Page is loading too long'))
    }, IFRAME_LOAD_TIMEOUT)

    const link = document.createElement('iframe')
    link.addEventListener('load', () => {
      clearTimeout(timerId)
      handleSuccess()
    })
    link.src = src
    link.style.display = 'none'
    link.sandbox = IFRAME_SANDBOX_ATTRIBUTES

    document.body.appendChild(link)

    const iframeDocument = link.contentWindow || link.contentDocuent
    if (iframeDocument) {
      iframeDocument.addEventListener('error', handleError)
    }
  })
}

async function loadVoila({ src }) {
  // Preload iframe, then insert cached iframe
  await waitForIframe(src)
  return PreviewData.IFrame({ src, sandbox: IFRAME_SANDBOX_ATTRIBUTES })
}

function VoilaLoader({ handle, children }) {
  const sign = AWS.Signer.useS3Signer()
  const endpoint = Config.use().registryUrl
  const src = `${endpoint}/voila/voila/render/${mkSearch({ url: sign(handle) })}`
  const data = Data.use(loadVoila, { src })
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
