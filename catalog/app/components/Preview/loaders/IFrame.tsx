import { dirname } from 'path'
import * as React from 'react'

import * as requests from 'containers/Bucket/requests'
import * as AWS from 'utils/AWS'
import * as Config from 'utils/Config'
import { useData } from 'utils/Data'
import { mkSearch } from 'utils/NamedRoutes'
import * as s3paths from 'utils/s3paths'
import type { PackageHandle } from 'utils/packageHandle'

import { PreviewData } from '../types'
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
      max_bytes: 20 * 1024 * 1024,
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
    if (utils.extIs('.csv')) {
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

interface AWSCredentials {
  accessKeyId: string
  secretAccessKey: string
  sessionToken: string
  getPromise: () => Promise<void>
}

interface Env {
  credentials: AWSCredentials
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
</script>
</head>`,
  )
}

function useContextEnv(handle: FileHandle): Env {
  const s3 = AWS.S3.use()
  const sign = AWS.Signer.useS3Signer()
  const credentials = AWS.Credentials.use()
  const config = Config.use()

  const data = useData(requests.bucketListing, {
    s3,
    bucket: handle.bucket,
    path: s3paths.ensureSlash(dirname(handle.key)),
  })
  const files = React.useMemo(
    () =>
      data.case({
        Err: () => [],
        _: () => [],
        Ok: (result: requests.BucketListingResult) =>
          prepareFiles(result.files, config, sign),
      }),
    [config, data, sign],
  )
  const { packageHandle, ...fileHandle } = handle
  return React.useMemo(
    () => ({
      credentials,
      fileHandle,
      package: {
        files,
        handle: packageHandle,
      },
    }),
    [credentials, fileHandle, files, packageHandle],
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
  handle: FileHandle
  children: (result: $TSFixMe) => React.ReactNode
}

export const Loader = function IFrameLoader({ handle, children }: IFrameLoaderProps) {
  const sign = AWS.Signer.useS3Signer()
  const src = React.useMemo(
    () => sign(handle, { ResponseContentType: 'text/html' }),
    [handle, sign],
  )
  const contextEnv = useContextEnv(handle)
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
      const srcDoc = prepareSrcDoc([head, tail].join('\n'), contextEnv)
      return PreviewData.IFrame({ srcDoc, src, note, warnings })
    },
  )
  return children(utils.useErrorHandling(processed, { handle, retry: fetch }))
}
