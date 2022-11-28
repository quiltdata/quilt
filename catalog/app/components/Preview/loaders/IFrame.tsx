import { dirname } from 'path'

import * as R from 'ramda'
import * as React from 'react'

import * as requests from 'containers/Bucket/requests'
import * as AWS from 'utils/AWS'
import * as Config from 'utils/Config'
import { mkSearch } from 'utils/NamedRoutes'
import * as s3paths from 'utils/s3paths'
import type { PackageHandle } from 'utils/packageHandle'

import { PreviewData } from '../types'

import * as iframeSdk from './IframeSdk'
import * as utils from './utils'

export const MAX_BYTES = 10 * 1024

type Sign = (handle: s3paths.S3HandleBase) => string

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

function prepareSrcDoc(html: string, env: Env) {
  return html.replace(
    '</head>',
    `
  <script>
    const requestEvent = ${iframeSdk.requestEvent.toString()}

    const listFiles = () => requestEvent("${iframeSdk.EVENT_NAME.LIST_FILES}")
    const findFile = async (partialHandle) => {
      const url = await requestEvent("${
        iframeSdk.EVENT_NAME.FIND_FILE_URL
      }", partialHandle)
      return window.fetch(decodeURIComponent(url))
    }
    const fetchFile = async (handle) => {
      const url = await requestEvent("${iframeSdk.EVENT_NAME.GET_FILE_URL}", handle)
      return window.fetch(decodeURIComponent(url))
    }

    function onReady(callback) {
      const env = ${JSON.stringify(env)}
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
          callback(env)
        })
      } else {
        callback(env)
      }
    }

    window.quilt = {
      fetchFile,
      findFile,
      listFiles,
      onReady,
    }

    window.quilt.onReady(async (env) => {
      const filesList = await window.quilt.listFiles()
      console.log('LIST FILES', filesList)

      const fileResponse = await window.quilt.fetchFile({ bucket: 'fiskus-sandbox-dev', key: 'fiskus/iframe/igv.json'})
      const fileData = await fileResponse.json()
      console.log('FETCH FILE', fileData)

      const foundResponse = await window.quilt.findFile({ key: 'movies.json' })
      const foundData = await foundResponse.json()
      console.log('FIND FILE', foundData)
    })
  </script>
</head>`,
  )
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

function useMessageBus(handle: FileHandle) {
  const s3 = AWS.S3.use()
  const sign = AWS.Signer.useS3Signer()
  const { apiGatewayEndpoint, binaryApiGatewayEndpoint } = Config.use()

  return React.useCallback(
    async ({ name, payload }) => {
      switch (name) {
        case 'list-files': {
          const response = await requests.bucketListing({
            s3,
            bucket: handle.bucket,
            path: s3paths.ensureSlash(dirname(handle.key)),
          })
          return response.files.map(R.pick(['bucket', 'key']))
        }
        case 'get-file-url': {
          const h = payload as s3paths.S3HandleBase
          if (utils.extIs('.csv')(h.key)) {
            return generateCsvUrl(h, binaryApiGatewayEndpoint, sign)
          }
          return generateJsonUrl(h, apiGatewayEndpoint, sign)
        }
        case 'find-file-url': {
          const { key: searchKey } = payload as { key: string }
          const response = await requests.bucketListing({
            s3,
            bucket: handle.bucket,
            path: s3paths.ensureSlash(dirname(handle.key)),
          })
          const h = response.files
            .map(R.pick(['bucket', 'key']))
            .find(({ key }) => key.endsWith(searchKey))
          if (!h) return null
          if (utils.extIs('.csv')(h.key)) {
            return generateCsvUrl(h, binaryApiGatewayEndpoint, sign)
          }
          return generateJsonUrl(h, apiGatewayEndpoint, sign)
        }
        default: {
          return null
        }
      }
    },
    [apiGatewayEndpoint, binaryApiGatewayEndpoint, handle, sign, s3],
  )
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

export const Loader = function IFrameLoader({ handle, children }: IFrameLoaderProps) {
  const env = useContextEnv(handle)

  const sign = AWS.Signer.useS3Signer()
  const onMessage = useMessageBus(handle)

  const src = React.useMemo(
    () => sign(handle, { ResponseContentType: 'text/html' }),
    [handle, sign],
  )
  const { result, fetch } = utils.usePreview({
    type: 'txt',
    handle,
    query: { max_bytes: MAX_BYTES },
  })
  const processed = utils.useProcessing(
    result,
    ({ info: { data, note, warnings } }: TextDataOutput) => {
      const head = data.head.join('\n')
      const tail = data.tail.join('\n')
      const srcDoc = prepareSrcDoc([head, tail].join('\n'), env)
      return PreviewData.IFrame({ onMessage, srcDoc, src, note, warnings })
    },
  )
  return <>{children(utils.useErrorHandling(processed, { handle, retry: fetch }))}</>
}
