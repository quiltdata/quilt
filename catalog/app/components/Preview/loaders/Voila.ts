import * as R from 'ramda'

import cfg from 'constants/config'
import type * as Model from 'model'
import * as AWS from 'utils/AWS'
import * as Data from 'utils/Data'
import type * as LogicalKeyResolver from 'utils/LogicalKeyResolver'
import mkSearch from 'utils/mkSearch'
import useMemoEq from 'utils/useMemoEq'

import { PreviewData } from '../types'

import FileType from './fileType'
import * as summarize from './summarize'
import * as utils from './utils'

export const FILE_TYPE = FileType.Voila

interface AWSCredentials {
  accessKeyId: string
  secretAccessKey: string
  sessionToken: string
  getPromise: () => Promise<void>
}

const getCredentialsQuery = (credentials: AWSCredentials) => ({
  access_key: credentials.accessKeyId,
  secret_key: credentials.secretAccessKey,
  session_token: credentials.sessionToken,
})

const useCredentialsQuery = () => getCredentialsQuery(AWS.Credentials.use().suspend())

function usePackageQuery(handle?: Model.Package.Handle, hash?: Model.Package.Hash) {
  if (!handle || !hash) return null
  return {
    pkg_bucket: handle.bucket,
    pkg_name: handle.name,
    pkg_top_hash: hash.value,
  }
}

export const detect = R.F

const IFRAME_SANDBOX_ATTRIBUTES = 'allow-scripts allow-same-origin allow-downloads'
const IFRAME_LOAD_TIMEOUT = 30000

function waitForIframe(src: string) {
  let resolved = false

  return new Promise((resolve, reject) => {
    const handleError = (error: Event | Error) => {
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
    link.setAttribute('sandbox', IFRAME_SANDBOX_ATTRIBUTES)

    document.body.appendChild(link)

    const iframeDocument = link.contentWindow || link.contentDocument
    if (iframeDocument) {
      iframeDocument.addEventListener('error', handleError)
    }
  })
}

async function loadVoila({ src }: { src: string }) {
  // Preload iframe, then insert cached iframe
  await waitForIframe(src)
  return PreviewData.Voila({
    src,
    sandbox: IFRAME_SANDBOX_ATTRIBUTES,
    modes: [FileType.Jupyter, FileType.Json, FileType.Voila, FileType.Text],
  })
}

const useVoilaUrl = (
  location: Model.S3.S3ObjectLocation,
  handle?: Model.Package.Handle,
  hash?: Model.Package.Hash,
) => {
  const sign = AWS.Signer.useS3Signer()
  const credentialsQuery = useCredentialsQuery()
  const packageQuery = usePackageQuery(handle, hash)
  return useMemoEq(
    [credentialsQuery, location, packageQuery, sign],
    () =>
      `${cfg.registryUrl}/voila/voila/render/${mkSearch({
        url: sign(location),
        ...credentialsQuery,
        ...packageQuery,
      })}`,
  )
}

interface LoaderOptions extends summarize.FileExtended {
  handle?: Model.Package.Handle
  hash?: Model.Package.Hash
}

interface VoilaLoaderProps {
  handle: LogicalKeyResolver.S3SummarizeHandle
  children: (r: $TSFixMe) => React.ReactNode
  options: LoaderOptions
}

export const Loader = function VoilaLoader({
  handle,
  children,
  options,
}: VoilaLoaderProps) {
  const src = useVoilaUrl(handle, options.handle, options.hash)
  const data = Data.use(loadVoila, { src })
  return children(utils.useErrorHandling(data.result, { handle, retry: data.fetch }))
}
