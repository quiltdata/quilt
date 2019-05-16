import { extname } from 'path'

import * as R from 'ramda'
import * as React from 'react'

import * as AWS from 'utils/AWS'
import AsyncResult from 'utils/AsyncResult'
import * as Config from 'utils/Config'
import Data from 'utils/Data'
import * as NamedRoutes from 'utils/NamedRoutes'

import { PreviewError } from '../types'

export const SIZE_THRESHOLDS = [
  128 * 1024, // automatically load if <= 128kB
  1024 * 1024, // never load if > 1MB
]

export const COMPRESSION_TYPES = { gz: '.gz', bz2: '.bz2' }

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

export const withSigner = (callback) => <AWS.Signer.Inject>{callback}</AWS.Signer.Inject>

export const withS3 = (callback) => <AWS.S3.Inject>{callback}</AWS.S3.Inject>

export const withRoutes = (callback) => (
  <NamedRoutes.Inject>{callback}</NamedRoutes.Inject>
)

export const withData = (props, callback) => <Data {...props}>{callback}</Data>

const gate = async ({ s3, handle }) => {
  let length
  try {
    const head = await s3
      .headObject({
        Bucket: handle.bucket,
        Key: handle.key,
        VersionId: handle.version,
      })
      .promise()
    length = head.ContentLength
  } catch (e) {
    if (['NoSuchKey', 'NotFound'].includes(e.name)) {
      throw PreviewError.DoesNotExist({ handle })
    }
    // eslint-disable-next-line no-console
    console.error('Error loading preview')
    // eslint-disable-next-line no-console
    console.error(e)
    throw PreviewError.Unexpected({ handle, originalError: e })
  }
  if (length > SIZE_THRESHOLDS[1]) {
    throw PreviewError.TooLarge({ handle })
  }
  return { handle, gated: length > SIZE_THRESHOLDS[0] }
}

export const gatedS3Request = (fetcher) => (handle, callback, extraParams) =>
  withS3((s3) =>
    withData(
      { fetch: gate, params: { s3, handle } },
      AsyncResult.case({
        Ok: ({ gated }) =>
          fetcher({ s3, handle, gated, ...extraParams }, (r, ...args) =>
            callback(AsyncResult.Ok(r), ...args),
          ),
        _: callback,
      }),
    ),
  )

const parseRange = (range) => {
  if (!range) return undefined
  const m = range.match(/bytes \d+-\d+\/(\d+)$/)
  if (!m) return undefined
  return Number(m[1])
}

const getFirstBytes = (bytes) => async ({ s3, handle }) => {
  try {
    const res = await s3
      .getObject({
        Bucket: handle.bucket,
        Key: handle.key,
        VersionId: handle.version,
        Range: `bytes=0-${bytes}`,
      })
      .promise()
    const firstBytes = res.Body.toString('utf-8')
    const contentLength = parseRange(res.ContentRange) || 0
    return { firstBytes, contentLength }
  } catch (e) {
    if (['NoSuchKey', 'NotFound'].includes(e.name)) {
      throw PreviewError.DoesNotExist({ handle })
    }
    // eslint-disable-next-line no-console
    console.error('Error loading preview')
    // eslint-disable-next-line no-console
    console.error(e)
    throw PreviewError.Unexpected({ handle, originalError: e })
  }
}

export const withFirstBytes = (bytes, fetcher) => {
  const fetch = getFirstBytes(bytes)

  return (handle, callback) =>
    withS3((s3) =>
      withData(
        { fetch, params: { s3, handle } },
        AsyncResult.case({
          Ok: ({ firstBytes, contentLength }) =>
            fetcher({ s3, handle, firstBytes, contentLength }, (r, ...args) =>
              callback(AsyncResult.Ok(r), ...args),
            ),
          _: callback,
        }),
      ),
    )
}

export const objectGetter = (process) => {
  const fetch = ({ s3, handle, ...extra }) =>
    s3
      .getObject({
        Bucket: handle.bucket,
        Key: handle.key,
        VersionId: handle.version,
      })
      .promise()
      .then((r) => process(r, { s3, handle, ...extra }))

  return ({ s3, handle, gated, ...extra }, callback) =>
    withData({ fetch, params: { s3, handle, ...extra }, noAutoFetch: gated }, callback)
}

const previewUrl = (endpoint, url, input, compression) =>
  `${endpoint}/preview${NamedRoutes.mkSearch({ url, input, compression })}`

const fetchPreview = async ({ endpoint, type, handle, signer }) => {
  const signed = signer.getSignedS3URL(handle)
  const compression = getCompression(handle.key)
  const r = await fetch(previewUrl(endpoint, signed, type, compression))
  const json = await r.json()
  return json
}

const withGatewayEndpoint = (callback) => (
  <Config.Inject>
    {AsyncResult.case({
      Err: R.pipe(
        AsyncResult.Err,
        callback,
      ),
      _: callback,
      Ok: R.pipe(
        R.prop('apiGatewayEndpoint'),
        AsyncResult.Ok,
        callback,
      ),
    })}
  </Config.Inject>
)

export const previewFetcher = (type, process) => {
  const fetch = (x) => fetchPreview(x).then((res) => process(res, x))
  return (handle, callback, extra) =>
    withSigner((signer) =>
      withGatewayEndpoint(
        AsyncResult.case({
          Err: (e, ...args) => {
            const pe = PreviewError.Unexpected({ handle, originalError: e })
            return callback(AsyncResult.Err(pe), ...args)
          },
          Ok: (endpoint) =>
            withData(
              { fetch, params: { endpoint, type, handle, signer, ...extra } },
              AsyncResult.case({
                _: callback,
                Err: (e, ...args) => {
                  const pe = PreviewError.Unexpected({ handle, originalError: e })
                  return callback(AsyncResult.Err(pe), ...args)
                },
              }),
            ),
          _: callback,
        }),
      ),
    )
}
