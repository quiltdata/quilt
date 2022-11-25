import { dirname } from 'path'

import * as R from 'ramda'
import * as React from 'react'

import * as requests from 'containers/Bucket/requests'
import * as AWS from 'utils/AWS'
import AsyncResult from 'utils/AsyncResult'
import * as Config from 'utils/Config'
import { useData } from 'utils/Data'
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

function prepareFiles(
  files: requests.BucketListingFile[],
  config: Config.Config,
  sign: Sign,
) {
  return files.map(({ bucket, key }) => {
    const handle = { bucket, key }
    if (utils.extIs('.csv')(key)) {
      return {
        handle,
        url: generateCsvUrl(handle, config.binaryApiGatewayEndpoint, sign),
      }
    }
    return {
      handle,
      url: generateJsonUrl(handle, config.apiGatewayEndpoint, sign),
    }
  })
}

interface Env {
  fileHandle: s3paths.S3HandleBase
  package: {
    files: {
      handle: s3paths.S3HandleBase
      url: string
    }[]
    handle: PackageHandle
  }
}

interface FileHandle extends s3paths.S3HandleBase {
  packageHandle: PackageHandle
}

function prepareSrcDoc(html: string, env: Env) {
  return html.replace(
    '</head>',
    `
  <script>
    window.env = ${JSON.stringify(env)}

    window.requestEvent = ${iframeSdk.requestEvent.toString()}

    window.listFiles = () => window.requestEvent('list-files')
    window.fetchFile = async (handle) => {
      const url = await window.requestEvent('fetch-file', handle)
      return window.fetch(decodeURIComponent(url))
    }

    document.addEventListener('DOMContentLoaded', async () => {
      const filesList = await window.listFiles()
      console.log('LIST FILES', filesList)

      const fileResponse = await window.fetchFile({ bucket: 'fiskus-sandbox-dev', key: 'fiskus/iframe/igv.json'})
      const fileData = await fileResponse.json()
      console.log('FETCH FILE', fileData)
    })
  </script>
</head>`,
  )
}

function useContextEnv(handle: FileHandle): Env {
  const s3 = AWS.S3.use()
  const sign = AWS.Signer.useS3Signer()
  const config = Config.use()

  const { packageHandle, ...fileHandle } = handle
  const { result, fetch } = useData(requests.bucketListing, {
    s3,
    bucket: handle.bucket,
    path: s3paths.ensureSlash(dirname(handle.key)),
  })
  const processed = utils.useProcessing(
    result,
    ({ files }: requests.BucketListingResult) => ({
      fileHandle,
      package: {
        files: prepareFiles(files, config, sign),
        handle: packageHandle,
      },
    }),
  )
  return utils.useErrorHandling(processed, { handle, retry: fetch })
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
  env: Env
  handle: FileHandle
}

function IFrameLoader({ env, handle, children }: IFrameLoaderProps) {
  const s3 = AWS.S3.use()
  const sign = AWS.Signer.useS3Signer()
  const { apiGatewayEndpoint, binaryApiGatewayEndpoint } = Config.use()

  const src = React.useMemo(
    () => sign(handle, { ResponseContentType: 'text/html' }),
    [handle, sign],
  )
  const onMessage = React.useCallback(
    async ({ name, payload }) => {
      switch (name) {
        case 'list-files':
          const response = await requests.bucketListing({
            s3,
            bucket: 'fiskus-sandbox-dev',
            path: 'fiskus/iframe/',
          })
          return response.files.map(R.pick(['bucket', 'key']))
        case 'fetch-file':
          const h = payload as s3paths.S3HandleBase
          if (utils.extIs('.csv')(h.key)) {
            return generateCsvUrl(h, binaryApiGatewayEndpoint, sign)
          }
          return generateJsonUrl(h, apiGatewayEndpoint, sign)
        default:
          return null
      }
    },
    [apiGatewayEndpoint, binaryApiGatewayEndpoint, sign, s3],
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
      return PreviewData.IFrame({ srcDoc, src, onMessage, note, warnings })
    },
  )
  return <>{children(utils.useErrorHandling(processed, { handle, retry: fetch }))}</>
}

interface IFrameEnvLoaderProps {
  handle: FileHandle
  children: (result: $TSFixMe) => React.ReactNode
}

export const Loader = function IFrameEnvLoader({
  handle,
  children,
}: IFrameEnvLoaderProps) {
  const envData = useContextEnv(handle)
  return AsyncResult.case({
    _: children,
    Ok: (env: Env) => <IFrameLoader {...{ env, handle, children }} />,
  })(envData)
}
