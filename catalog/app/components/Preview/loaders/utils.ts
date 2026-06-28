import { extname } from 'path'

import * as R from 'ramda'
import * as React from 'react'

import cfg from 'constants/config'
import * as AWS from 'utils/AWS'
import AsyncResult from 'utils/AsyncResult'
import * as Data from 'utils/Data'
import { mkSearch } from 'utils/NamedRoutes'
import pipeThru from 'utils/pipeThru'
import useMemoEq from 'utils/useMemoEq'

import { PreviewError } from '../types'

export const COMPRESSION_TYPES = { gz: '.gz', bz2: '.bz2' }

type CompressionType = keyof typeof COMPRESSION_TYPES

export const GLACIER_ERROR_RE =
  /<Code>InvalidObjectState<\/Code><Message>The operation is not valid for the object's storage class<\/Message>/

// eslint-disable-next-line consistent-return
export const getCompression = (key: string): CompressionType | undefined => {
  // eslint-disable-next-line no-restricted-syntax
  for (const [type, ext] of Object.entries(COMPRESSION_TYPES)) {
    if (key.endsWith(ext)) return type as CompressionType
  }
}

export const stripCompression = (key: string): string => {
  const comp = getCompression(key)
  return comp ? key.slice(0, -COMPRESSION_TYPES[comp].length) : key
}

export const extIs = (ext: string) => (key: string) => extname(key).toLowerCase() === ext

export const extIn = (exts: string[]) => (key: string) =>
  exts.includes(extname(key).toLowerCase())

const parseRange = (range: string | undefined): number | undefined => {
  if (!range) return undefined
  const m = range.match(/bytes \d+-\d+\/(\d+)$/)
  if (!m) return undefined
  return Number(m[1])
}

interface S3Args {
  s3: $TSFixMe
  handle: $TSFixMe
}

const getContentLength = async ({ s3, handle }: S3Args) => {
  const req = s3.headObject({
    Bucket: handle.bucket,
    Key: handle.key,
    VersionId: handle.version,
  })
  const head = await req.promise()
  return head.ContentLength
}

const getFirstBytes = async ({ s3, bytes, handle }: S3Args & { bytes: number }) => {
  try {
    const fileSize = await getContentLength({ s3, handle })
    const res = await s3
      .getObject({
        Bucket: handle.bucket,
        Key: handle.key,
        VersionId: handle.version,
        Range: `bytes=0-${Math.min(bytes, fileSize)}`,
      })
      .promise()
    const firstBytes = res.Body.toString('utf-8')
    const contentLength = parseRange(res.ContentRange) || 0
    return { firstBytes, contentLength }
  } catch (e: $TSFixMe) {
    if (['NoSuchKey', 'NotFound'].includes(e.code)) {
      throw PreviewError.DoesNotExist({ handle })
    }
    if (e.code === 'InvalidObjectState') {
      throw PreviewError.Archived({ handle })
    }
    if (e.code === 'InvalidArgument' && e.message === 'Invalid version id specified') {
      throw PreviewError.InvalidVersion({ handle })
    }
    // eslint-disable-next-line no-console
    console.error('Error loading preview')
    // eslint-disable-next-line no-console
    console.error(e)
    throw e
  }
}

export function useFirstBytes({ bytes, handle }: { bytes: number; handle: $TSFixMe }) {
  const s3 = AWS.S3.use()
  return Data.use(getFirstBytes, { s3, bytes, handle })
}

export const getObject = ({ s3, handle }: S3Args) =>
  s3
    .getObject({
      Bucket: handle.bucket,
      Key: handle.key,
      VersionId: handle.version,
    })
    .promise()
    .catch((e: $TSFixMe) => {
      if (['NoSuchKey', 'NotFound'].includes(e.code)) {
        throw PreviewError.DoesNotExist({ handle })
      }
      if (e.code === 'InvalidObjectState') {
        throw PreviewError.Archived({ handle })
      }
      if (e.code === 'InvalidArgument' && e.message === 'Invalid version id specified') {
        throw PreviewError.InvalidVersion({ handle })
      }
      throw e
    })

export function useObjectGetter(handle: $TSFixMe, opts?: $TSFixMe) {
  const s3 = AWS.S3.use()
  return Data.use(getObject, { s3, handle }, opts)
}

interface FetchPreviewArgs {
  handle: $TSFixMe
  sign: $TSFixMe
  type: string
  compression: CompressionType | undefined
  query?: $TSFixMe
}

const fetchPreview = async ({
  handle,
  sign,
  type,
  compression,
  query,
}: FetchPreviewArgs) => {
  const url = sign(handle)
  const r = await fetch(
    `${cfg.apiGatewayEndpoint}/preview${mkSearch({
      url,
      input: type,
      compression,
      ...query,
    })}`,
  )
  const json = await r.json()
  if (json.error) {
    if (json.error === 'Not Found') {
      throw PreviewError.DoesNotExist({ handle })
    }
    if (json.error === 'Forbidden') {
      if (json.text && json.text.match(GLACIER_ERROR_RE)) {
        throw PreviewError.Archived({ handle })
      }
      throw PreviewError.Forbidden({ handle })
    }
    // eslint-disable-next-line no-console
    console.log('Error from preview endpoint', json)
    throw new Error(json.error)
  }
  return json
}

export function usePreview(
  { type, handle, query }: { type: string; handle: $TSFixMe; query?: $TSFixMe },
  options?: $TSFixMe,
) {
  const sign = AWS.Signer.useS3Signer()
  const compression = getCompression(handle.key)
  return Data.use(fetchPreview, { handle, sign, type, compression, query }, options)
}

export function useProcessing(
  asyncResult: $TSFixMe,
  process: (value: $TSFixMe) => $TSFixMe,
  deps: unknown[] = [],
) {
  return useMemoEq([asyncResult, deps], () =>
    AsyncResult.case(
      {
        Ok: (value: $TSFixMe) => {
          try {
            return AsyncResult.Ok(process(value))
          } catch (e: $TSFixMe) {
            // Re-throw thenables: a Suspense signal (lazy grammar load) must reach
            // the boundary, not become an Err.
            if (e && typeof e.then === 'function') throw e
            return AsyncResult.Err(e)
          }
        },
        _: R.identity,
      },
      asyncResult,
    ),
  )
}

export function useAsyncProcessing(
  asyncResult: $TSFixMe,
  process: (value: $TSFixMe) => Promise<$TSFixMe>,
  deps: unknown[] = [],
) {
  const fn = React.useCallback(
    async (args: $TSFixMe) =>
      AsyncResult.case(
        {
          Ok: (value: $TSFixMe) => process(value).then(AsyncResult.Ok, AsyncResult.Err),
          _: R.identity,
        },
        args.asyncResult,
      ),
    [process],
  )
  return Data.use(fn, { asyncResult, deps }).case({
    Ok: R.identity,
    _: R.identity,
  })
}

export function useErrorHandling(
  result: $TSFixMe,
  { handle, retry }: { handle?: $TSFixMe; retry?: $TSFixMe } = {},
) {
  return useMemoEq([result, handle, retry], () =>
    pipeThru(result)(
      AsyncResult.mapCase({
        Err: R.unless(PreviewError.is, (e: $TSFixMe) => {
          // eslint-disable-next-line no-console
          console.log('error while loading preview')
          // eslint-disable-next-line no-console
          console.error(e)
          return PreviewError.Unexpected({ handle, retry, originalError: e })
        }),
      }),
    ),
  )
}
