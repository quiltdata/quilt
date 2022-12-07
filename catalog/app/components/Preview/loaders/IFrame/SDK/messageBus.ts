import { dirname } from 'path'

import * as R from 'ramda'
import * as React from 'react'

import * as requests from 'containers/Bucket/requests'
import * as AWS from 'utils/AWS'
import * as Config from 'utils/Config'
import { mkSearch } from 'utils/NamedRoutes'
import * as LogicalKeyResolver from 'utils/LogicalKeyResolver'
import * as s3paths from 'utils/s3paths'

import { createPathResolver, createUrlProcessor } from '../../useSignObjectUrls'
import * as utils from '../../utils'

import { EVENT_NAME } from './'

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

interface PartialS3Handle {
  bucket?: string
  key: string
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

export default function useMessageBus(handle: s3paths.S3HandleBase) {
  const signUrl = useSignedUrl(handle)
  const signPreviewUrl = useSignedPreviewUrl(handle)
  const listFiles = useListFilesInCurrentDir(handle)

  return React.useCallback(
    async ({ name, payload }) => {
      // TODO: error handling
      switch (name) {
        case EVENT_NAME.LIST_FILES: {
          return listFiles()
        }
        case EVENT_NAME.GET_FILE_URL: {
          return signPreviewUrl(payload as PartialS3Handle)
        }
        case EVENT_NAME.SIGN_URL: {
          return signUrl(payload as string)
        }
        case EVENT_NAME.FIND_FILE_URL: {
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
