import { extname } from 'path'

import * as R from 'ramda'
import * as React from 'react'

import * as AWS from 'utils/AWS'
import AsyncResult from 'utils/AsyncResult'
import * as Config from 'utils/Config'
import * as Data from 'utils/Data'
import { mkSearch } from 'utils/NamedRoutes'
import pipeThru from 'utils/pipeThru'
import useMemoEq from 'utils/useMemoEq'

import { PreviewError } from '../types'

export const SIZE_THRESHOLDS = [
  128 * 1024, // automatically load if <= 128kB
  1024 * 1024, // never load if > 1MB
]

export const COMPRESSION_TYPES = { gz: '.gz', bz2: '.bz2' }

export const GLACIER_ERROR_RE =
  /<Code>InvalidObjectState<\/Code><Message>The operation is not valid for the object's storage class<\/Message>/

// eslint-disable-next-line consistent-return
export const getCompression = (key) => {
  // eslint-disable-next-line no-restricted-syntax
  for (const [type, ext] of Object.entries(COMPRESSION_TYPES)) {
    if (key.endsWith(ext)) return type
  }
}

export const stripCompression = (key) => {
  const comp = getCompression(key)
  return comp ? key.slice(0, -COMPRESSION_TYPES[comp].length) : key
}

export const extIs = (ext) => (key) => extname(key).toLowerCase() === ext

export const extIn = (exts) => (key) => exts.includes(extname(key).toLowerCase())

// TODO: make it more general-purpose "head"?
const gate = async ({ s3, handle }) => {
  let length
  const req = s3.headObject({
    Bucket: handle.bucket,
    Key: handle.key,
    VersionId: handle.version,
  })
  try {
    const head = await req.promise()
    length = head.ContentLength
    if (head.DeleteMarker) throw PreviewError.Deleted({ handle })
    if (head.StorageClass === 'GLACIER' || head.StorageClass === 'DEEP_ARCHIVE') {
      throw PreviewError.Archived({ handle })
    }
  } catch (e) {
    if (PreviewError.is(e)) throw e
    // TODO: should it be 'status'?
    if (e.code === 405 && handle.version != null) {
      // assume delete marker when 405 and version is defined,
      // since GET and HEAD methods are not allowed on delete markers
      // (https://github.com/boto/botocore/issues/674)
      throw PreviewError.Deleted({ handle })
    }
    if (e.code === 'BadRequest' && handle.version != null) {
      // assume invalid version when 400 and version is defined
      throw PreviewError.InvalidVersion({ handle })
    }
    if (
      e.code === 'NotFound' &&
      req.response.httpResponse.headers['x-amz-delete-marker'] === 'true'
    ) {
      throw PreviewError.Deleted({ handle })
    }
    if (['NoSuchKey', 'NotFound'].includes(e.name)) {
      throw PreviewError.DoesNotExist({ handle })
    }
    // eslint-disable-next-line no-console
    console.error('Error loading preview')
    // eslint-disable-next-line no-console
    console.error(e)
    throw e
  }
  if (length > SIZE_THRESHOLDS[1]) {
    throw PreviewError.TooLarge({ handle })
  }
  return length > SIZE_THRESHOLDS[0]
}

export function useGate(handle) {
  const s3 = AWS.S3.use()
  return Data.use(gate, { s3, handle })
}

const parseRange = (range) => {
  if (!range) return undefined
  const m = range.match(/bytes \d+-\d+\/(\d+)$/)
  if (!m) return undefined
  return Number(m[1])
}

const getContentLength = async ({ s3, handle }) => {
  const req = s3.headObject({
    Bucket: handle.bucket,
    Key: handle.key,
    VersionId: handle.version,
  })
  const head = await req.promise()
  return head.ContentLength
}

const getFirstBytes = async ({ s3, bytes, handle }) => {
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
  } catch (e) {
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

export function useFirstBytes({ bytes, handle }) {
  const s3 = AWS.S3.use()
  return Data.use(getFirstBytes, { s3, bytes, handle })
}

export const getObject = ({ s3, handle }) =>
  s3
    .getObject({
      Bucket: handle.bucket,
      Key: handle.key,
      VersionId: handle.version,
    })
    .promise()
    .catch((e) => {
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

export function useObjectGetter(handle, opts) {
  const s3 = AWS.S3.use()
  return Data.use(getObject, { s3, handle }, opts)
}

const fetchPreview = async ({ endpoint, handle, sign, type, compression, query }) => {
  const url = sign(handle)
  const r = await fetch(
    `${endpoint}/preview${mkSearch({ url, input: type, compression, ...query })}`,
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

export function usePreview({ type, handle, query }, options) {
  const { apiGatewayEndpoint: endpoint } = Config.use()
  const sign = AWS.Signer.useS3Signer()
  const compression = getCompression(handle.key)
  return Data.use(
    fetchPreview,
    { endpoint, handle, sign, type, compression, query },
    options,
  )
}

export function useProcessing(asyncResult, process, deps = []) {
  return useMemoEq([asyncResult, deps], () =>
    AsyncResult.case(
      {
        Ok: R.tryCatch(R.pipe(process, AsyncResult.Ok), AsyncResult.Err),
        _: R.identity,
      },
      asyncResult,
    ),
  )
}

export function useAsyncProcessing(asyncResult, process, deps = []) {
  const fn = React.useCallback(
    async (args) =>
      AsyncResult.case(
        {
          Ok: (value) => process(value).then(AsyncResult.Ok, AsyncResult.Err),
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

export function useErrorHandling(result, { handle, retry } = {}) {
  return useMemoEq([result, handle, retry], () =>
    pipeThru(result)(
      AsyncResult.mapCase({
        Err: R.unless(PreviewError.is, (e) => {
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
