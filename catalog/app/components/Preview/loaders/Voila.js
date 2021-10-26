import * as AWS from 'utils/AWS'
import * as Data from 'utils/Data'
import * as Config from 'utils/Config'
import mkSearch from 'utils/mkSearch'
import useMemoEq from 'utils/useMemoEq'

import { PreviewData } from '../types'
import * as utils from './utils'

const getCredentialsQuery = (credentials) => ({
  access_key: credentials.accessKeyId,
  secret_key: credentials.secretAccessKey,
  session_token: credentials.sessionToken,
})

const useCredentialsQuery = () => getCredentialsQuery(AWS.Credentials.use().suspend())

export const detect = (key, options) => options?.types?.includes('voila')

const IFRAME_SANDBOX_ATTRIBUTES = 'allow-scripts allow-same-origin allow-downloads'
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
      handleError(new Error('Page is taking too long to load'))
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

    const iframeDocument = link.contentWindow || link.contentDocument
    if (iframeDocument) {
      iframeDocument.addEventListener('error', handleError)
    }
  })
}

async function loadVoila({ src, style }) {
  // Preload iframe, then insert cached iframe
  await waitForIframe(src)
  return PreviewData.IFrame({
    src,
    sandbox: IFRAME_SANDBOX_ATTRIBUTES,
    style,
  })
}

const useVoilaUrl = (handle) => {
  const sign = AWS.Signer.useS3Signer()
  const endpoint = Config.use().registryUrl
  const credentialsQuery = useCredentialsQuery()
  return useMemoEq(
    [credentialsQuery, endpoint, handle, sign],
    () =>
      `${endpoint}/voila/voila/render/${mkSearch({
        url: sign(handle),
        ...credentialsQuery,
      })}`,
  )
}

export const Loader = function VoilaLoader({ handle, children, options }) {
  const src = useVoilaUrl(handle)
  const style = React.useMemo(
    () => (options.height ? { height: options.height } : null),
    [options.height],
  )
  const data = Data.use(loadVoila, { src, style })
  return children(utils.useErrorHandling(data.result, { handle, retry: data.fetch }))
}
