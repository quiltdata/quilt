import * as AWS from 'utils/AWS'
import * as Data from 'utils/Data'
import * as Config from 'utils/Config'
import mkSearch from 'utils/mkSearch'
import { PackageHandle } from 'utils/packageHandle'
import useMemoEq from 'utils/useMemoEq'

import { PreviewData } from '../types'
import * as utils from './utils'

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

function usePackageQuery(packageHandle: PackageHandle) {
  if (!packageHandle) return null
  return {
    pkg_bucket: packageHandle.bucket,
    pkg_name: packageHandle.name,
    pkg_top_hash: packageHandle.hash,
  }
}

type SummaryType = string | { name: string }

interface LoaderOptions {
  types?: SummaryType[]
}

const FILE_TYPE = 'voila'
export const detect = (key: string, options: LoaderOptions) =>
  options?.types?.find((type) =>
    typeof type === 'string' ? type === FILE_TYPE : type.name === FILE_TYPE,
  )

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
  return PreviewData.Voila({ src, sandbox: IFRAME_SANDBOX_ATTRIBUTES })
}

interface FileHandle {
  bucket: string
  key: string
  version: string
  packageHandle: PackageHandle
}

const useVoilaUrl = (handle: FileHandle) => {
  const sign = AWS.Signer.useS3Signer()
  const endpoint = Config.use().registryUrl
  const credentialsQuery = useCredentialsQuery()
  const packageQuery = usePackageQuery(handle.packageHandle)
  return useMemoEq(
    [credentialsQuery, endpoint, handle, packageQuery, sign],
    () =>
      `${endpoint}/voila/voila/render/${mkSearch({
        url: sign(handle),
        ...credentialsQuery,
        ...packageQuery,
      })}`,
  )
}

interface VoilaLoaderProps {
  handle: FileHandle
  children: (r: $TSFixMe) => React.ReactNode
}

export const Loader = function VoilaLoader({ handle, children }: VoilaLoaderProps) {
  const src = useVoilaUrl(handle)
  const data = Data.use(loadVoila, { src })
  return children(utils.useErrorHandling(data.result, { handle, retry: data.fetch }))
}
