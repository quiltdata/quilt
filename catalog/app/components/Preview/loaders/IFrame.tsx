import { dirname } from 'path'
import * as React from 'react'

import * as requests from 'containers/Bucket/requests'
import * as AWS from 'utils/AWS'
import { useData } from 'utils/Data'
import * as s3paths from 'utils/s3paths'
import type { PackageHandle } from 'utils/packageHandle'

import { PreviewData } from '../types'
import * as utils from './utils'

export const MAX_BYTES = 10 * 1024

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

function useIFrameInjector(handle: FileHandle) {
  const s3 = AWS.S3.use()
  const data = useData(requests.bucketListing, {
    s3,
    bucket: handle.bucket,
    path: s3paths.ensureSlash(dirname(handle.key)),
  })

  const sign = AWS.Signer.useS3Signer()
  const src = React.useMemo(
    () => sign(handle, { ResponseContentType: 'text/html' }),
    [handle, sign],
  )

  const files = React.useMemo(
    () =>
      data.case({
        Err: () => [],
        _: () => [],
        Ok: (result: requests.BucketListingResult) =>
          result.files.map(({ bucket, key }) => ({
            handle: {
              bucket,
              key,
            },
            url: sign({ bucket, key }),
          })),
      }),
    [data, sign],
  )

  const credentials = AWS.Credentials.use()
  const { packageHandle, ...fileHandle } = handle
  const env: Env = React.useMemo(
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
  return React.useCallback(
    (html: string) => {
      const srcDoc = html.replace(
        '</head>',
        `
<script>
window.env = ${JSON.stringify(env)}
</script>
</head>`,
      )
      return {
        srcDoc,
        src,
      }
    },
    [env, src],
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
  const iframeInjector = useIFrameInjector(handle)
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
      const { srcDoc, src } = iframeInjector([head, tail].join('\n'))
      return PreviewData.IFrame({ srcDoc, src, note, warnings })
    },
  )
  return children(utils.useErrorHandling(processed, { handle, retry: fetch }))
}
