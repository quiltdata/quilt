import { dirname } from 'path'

import * as R from 'ramda'
import * as React from 'react'

import * as requests from 'containers/Bucket/requests'
import * as AWS from 'utils/AWS'
import * as Config from 'utils/Config'
import * as LogicalKeyResolver from 'utils/LogicalKeyResolver'
import { mkSearch } from 'utils/NamedRoutes'
import * as s3paths from 'utils/s3paths'
import type { PackageHandle } from 'utils/packageHandle'
import * as iframeSdk from 'utils/IframeSdk'

import { PreviewData } from '../../types'

import { createPathResolver, createUrlProcessor } from '../useSignObjectUrls'
import * as utils from '../utils'

type Sign = (handle: s3paths.S3HandleBase) => string

const MAX_BYTES = 10 * 1024

function generateJsonUrl(handle: s3paths.S3HandleBase, endpoint: string, sign: Sign) {
  return encodeURIComponent(
    `${endpoint}/preview${mkSearch({
      url: sign(handle),
      input: 'txt',
      max_bytes: 20 * 1024 * 1024,
    })}`,
  )
}

function generateCsvUrl(handle: s3paths.S3HandleBase, endpoint: string, sign: Sign) {
  return encodeURIComponent(
    `${endpoint}/tabular-preview${mkSearch({
      url: sign(handle),
      input: 'csv',
      size: 'large',
    })}`,
  )
}

interface Env {
  fileHandle: s3paths.S3HandleBase
  packageHandle: PackageHandle
}

interface FileHandle extends s3paths.S3HandleBase {
  packageHandle: PackageHandle
}

// TODO: return info and warnings as well
//       and render them with lambda warnings
function prepareSrcDoc(html: string, env: Env, scripts: string) {
  return html.replace(
    '</head>',
    `${scripts}

  <script>
    function onReady(callback) {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => callback(window.quilt.env))
      } else {
        callback(window.quilt.env)
      }
    }
    if (!window.quilt) {
      window.quilt = {}
    }
    window.quilt.env = ${JSON.stringify(env)}
    window.quilt.onReady = onReady
  </script>
</head>`,
  )
}

interface PartialS3Handle {
  bucket?: string
  key: string
}

function useContextEnv(handle: FileHandle): Env {
  return React.useMemo(() => {
    const { packageHandle, ...fileHandle } = handle
    return {
      fileHandle,
      packageHandle,
    }
  }, [handle])
}

function useSignedUrl(handle: s3paths.S3HandleBase) {
  const sign = AWS.Signer.useS3Signer()
  const resolveLogicalKey = LogicalKeyResolver.use()
  const resolvePath = React.useMemo(
    () => createPathResolver(resolveLogicalKey, handle),
    [resolveLogicalKey, handle],
  )
  const processUrl = React.useMemo(
    () => createUrlProcessor(sign, resolvePath),
    [sign, resolvePath],
  )
  return React.useCallback((url: string) => processUrl(url), [processUrl])
}

function useSignedPreviewUrl(baseHandle: s3paths.S3HandleBase) {
  const sign = AWS.Signer.useS3Signer()
  const config = Config.use()
  return React.useCallback(
    (partialHandle: PartialS3Handle) => {
      const handle = {
        key: partialHandle.key,
        bucket: partialHandle.bucket || baseHandle.bucket,
      }
      if (utils.extIs('.csv')(handle.key)) {
        return generateCsvUrl(handle, config.binaryApiGatewayEndpoint, sign)
      }
      if (utils.extIs('.json')(handle.key)) {
        return generateJsonUrl(handle, config.apiGatewayEndpoint, sign)
      }
      return sign(handle)
    },
    [config, baseHandle, sign],
  )
}

function useListFilesInCurrentDir(baseHandle: s3paths.S3HandleBase) {
  const s3 = AWS.S3.use()
  return React.useCallback(async (): Promise<s3paths.S3HandleBase[]> => {
    const response = await requests.bucketListing({
      s3,
      bucket: baseHandle.bucket,
      path: s3paths.ensureSlash(dirname(baseHandle.key)),
    })
    return response.files.map(R.pick(['bucket', 'key']))
  }, [baseHandle, s3])
}

// TODO: Move to utils/IframeSdk/messageBus.ts
function useMessageBus(handle: FileHandle) {
  const signUrl = useSignedUrl(handle)
  const signPreviewUrl = useSignedPreviewUrl(handle)
  const listFiles = useListFilesInCurrentDir(handle)

  return React.useCallback(
    async ({ name, payload }) => {
      // TODO: error handling
      switch (name) {
        case iframeSdk.EVENT_NAME.LIST_FILES: {
          return listFiles()
        }
        case iframeSdk.EVENT_NAME.GET_FILE_URL: {
          return signPreviewUrl(payload as PartialS3Handle)
        }
        case iframeSdk.EVENT_NAME.SIGN_URL: {
          return signUrl(payload as string)
        }
        case iframeSdk.EVENT_NAME.FIND_FILE_URL: {
          const { key: searchKey } = payload as PartialS3Handle
          const files = await listFiles()
          const h = files.find(({ key }) => key.endsWith(searchKey))
          if (!h) return null
          return signPreviewUrl(h)
        }
        default: {
          return null
        }
      }
    },
    [listFiles, signUrl, signPreviewUrl],
  )
}

function useInjectedScripts() {
  return React.useCallback(async () => {
    const response = await window.fetch('/__iframe-sdk')
    const html = await response.text()
    return html.replace('<html>', '').replace('</html>', '')
  }, [])
}

interface TextDataOutput {
  info: {
    data: {
      head: string[]
      tail: string[]
    }
    note: string
    warnings: string
  }
}

interface IFrameLoaderProps {
  children: (result: $TSFixMe) => React.ReactNode
  handle: FileHandle
}

export default function ExtendedIFrameLoader({ handle, children }: IFrameLoaderProps) {
  const env = useContextEnv(handle)

  const sign = AWS.Signer.useS3Signer()
  const onMessage = useMessageBus(handle)

  const injectScripts = useInjectedScripts()

  const src = React.useMemo(
    () => sign(handle, { ResponseContentType: 'text/html' }),
    [handle, sign],
  )
  const { result, fetch } = utils.usePreview({
    type: 'txt',
    handle,
    query: { max_bytes: MAX_BYTES },
  })
  const processed = utils.useAsyncProcessing(
    result,
    async ({ info: { data, note, warnings } }: TextDataOutput) => {
      const scripts = await injectScripts()
      const head = data.head.join('\n')
      const tail = data.tail.join('\n')
      // TODO: get storage class
      const srcDoc = prepareSrcDoc([head, tail].join('\n'), env, scripts)
      return PreviewData.IFrame({ onMessage, srcDoc, src, note, warnings })
    },
  )
  return children(utils.useErrorHandling(processed, { handle, retry: fetch }))
}
