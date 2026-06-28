import type { S3 } from 'aws-sdk'
import * as Eff from 'effect'
import sampleSize from 'lodash/fp/sampleSize'
import * as R from 'ramda'

import quiltSummarizeSchema from 'schemas/quilt_summarize.json'

import { SUPPORTED_EXTENSIONS as IMG_EXTS } from 'components/Thumbnail'
import * as Resource from 'utils/Resource'
import { makeSchemaValidator } from 'utils/JSONSchema'
import mkSearch from 'utils/mkSearch'
import * as s3paths from 'utils/s3paths'
import tagged from 'utils/tagged'

import { getArchiveState } from 'utils/glacier'
import { decodeS3Key } from './utils'

// The catalog's `req` API connector: issues a request to a relative endpoint and
// resolves to the parsed JSON response (intrinsically dynamic shape).
type Req = (path: string) => Promise<any>

const parseDate = (d: string | number | Date | undefined | null) => d && new Date(d)

const processStats = R.applySpec({
  exts: R.pipe(
    R.path(['aggregations', 'exts', 'buckets']) as any,
    R.map((i: any) => ({
      ext: i.key,
      objects: i.doc_count,
      bytes: i.size.value,
    })),
    R.sort(R.descend(R.prop('bytes'))),
  ),
  totalObjects: R.path(['hits', 'total']),
  totalBytes: R.path(['aggregations', 'totalBytes', 'value']),
})

interface BucketStatsArgs {
  req: Req
  bucket: string
}

export const bucketStats = async ({ req, bucket }: BucketStatsArgs) => {
  try {
    const qs = mkSearch({ index: bucket, action: 'stats' })
    const result = await req(`/search${qs}`)
    return processStats(result)
  } catch (e) {
    // eslint-disable-next-line no-console
    console.log('Unable to fetch live stats:')
    // eslint-disable-next-line no-console
    console.error(e)
  }

  throw new Error('Stats unavailable')
}

const README_KEYS = ['README.md', 'README.txt', 'README.ipynb']
const SAMPLE_EXTS = [
  '*.parquet',
  '*.parquet.gz',
  '*.csv',
  '*.csv.gz',
  '*.tsv',
  '*.tsv.gz',
  '*.txt',
  '*.txt.gz',
  '*.vcf',
  '*.vcf.gz',
  '*.xls',
  '*.xls.gz',
  '*.xlsx',
  '*.xlsx.gz',
  '*.ipynb',
  '*.md',
  '*.pdf',
  '*.pdf.gz',
  '*.json',
  '*.json.gz',
]
const SAMPLE_SIZE = 20
const SUMMARIZE_KEY = 'quilt_summarize.json'
const MAX_IMGS = 100

export const ObjectExistence = tagged(['Exists', 'DoesNotExist'])

interface GetObjectExistenceArgs {
  s3: S3
  bucket: string
  key: string
  version?: string
}

export async function getObjectExistence({
  s3,
  bucket,
  key,
  version,
}: GetObjectExistenceArgs) {
  const req = s3.headObject({ Bucket: bucket, Key: key, VersionId: version })
  try {
    const h = await req.promise()
    const { restoring, archived } = getArchiveState(h.StorageClass, h.Restore)
    return ObjectExistence.Exists({
      bucket,
      key,
      version: h.VersionId,
      size: h.ContentLength,
      deleted: !!h.DeleteMarker,
      // `archived` carries the storage class (or `false`) — no separate field.
      archived,
      restoring,
      lastModified: parseDate(h.LastModified),
    })
  } catch (e: any) {
    if (e.code === 405 && version != null) {
      // assume delete marker when 405 and version is defined,
      // since GET and HEAD methods are not allowed on delete markers
      // (https://github.com/boto/botocore/issues/674)
      return ObjectExistence.Exists({ bucket, key, version, deleted: true })
    }
    if (e.code === 'BadRequest' && version != null) {
      // assume invalid version when 400 and version is defined
      return ObjectExistence.DoesNotExist()
    }
    if (e.code === 'NotFound') {
      const { headers } = (req as any).response.httpResponse
      if (headers['x-amz-delete-marker'] === 'true') {
        return ObjectExistence.Exists({
          bucket,
          key,
          version: headers['x-amz-version-id'],
          deleted: true,
        })
      }
      return ObjectExistence.DoesNotExist()
    }
    throw e
  }
}

export const ensureObjectIsPresent = (...args: Parameters<typeof getObjectExistence>) =>
  getObjectExistence(...args).then(
    ObjectExistence.case({
      Exists: ({ deleted, archived, restoring, ...h }: any) =>
        deleted || archived ? null : h,
      _: () => null,
    }),
  )

interface EnsureQuiltSummarizeIsPresentArgs {
  s3: S3
  bucket: string
}

export const ensureQuiltSummarizeIsPresent = ({
  s3,
  bucket,
}: EnsureQuiltSummarizeIsPresentArgs) =>
  ensureObjectIsPresent({ s3, bucket, key: SUMMARIZE_KEY })

interface BucketSummaryFallbackArgs {
  s3: S3
  req: Req
  bucket: string
  inStack: boolean
}

// Auto-discovered summary entries (no quilt_summarize.json): an Elasticsearch
// sample when the bucket is in-stack, otherwise an S3 listing filtered by
// extension. Each discovered file is its own single-file entry.
const bucketSummaryFallback = async ({
  s3,
  req,
  bucket,
  inStack,
}: BucketSummaryFallbackArgs) => {
  if (inStack) {
    try {
      const qs = mkSearch({ action: 'sample', index: bucket })
      const result = await req(`/search${qs}`)
      return Eff.pipe(
        result,
        R.pathOr([], ['aggregations', 'objects', 'buckets']),
        R.map((h: any) => {
          // eslint-disable-next-line no-underscore-dangle
          const s = h.latest.hits.hits[0]._source
          return { bucket, key: s.key, version: s.version_id }
        }),
        R.take(SAMPLE_SIZE),
        R.map(R.objOf('handle')),
      )
    } catch (e) {
      // eslint-disable-next-line no-console
      console.log('Unable to fetch live summary:')
      // eslint-disable-next-line no-console
      console.error(e)
    }
  }
  try {
    const result = await s3
      .listObjectsV2({ Bucket: bucket, EncodingType: 'url' })
      .promise()
    return Eff.pipe(
      result,
      R.path(['Contents']),
      R.map(R.evolve({ Key: decodeS3Key })) as (a: any) => any[],
      R.filter(
        R.propSatisfies(
          R.allPass([
            R.complement(R.startsWith('.quilt/')),
            R.complement(R.startsWith('/')),
            R.complement(R.endsWith(SUMMARIZE_KEY)),
            R.complement(R.includes(R.__, README_KEYS)),
            R.anyPass(SAMPLE_EXTS.map(R.unary(R.endsWith))),
          ]),
          'Key',
        ),
      ),
      sampleSize(SAMPLE_SIZE) as any,
      R.map(({ Key: key }: any) => ({ key, bucket })),
      R.map(R.objOf('handle')),
    )
  } catch (e) {
    // eslint-disable-next-line no-console
    console.log('Unable to fetch summary from S3 listing:')
    // eslint-disable-next-line no-console
    console.error(e)
  }
  return []
}

interface BucketSummaryArgs {
  s3: S3
  req: Req
  bucket: string
  inStack: boolean
  withSource?: boolean
}

// When `withSource` is false (the default, used by the legacy Overview), the
// return value is the flat entries array. When
// `withSource` is true, returns `{ entries, fromQuiltSummarize }` so callers
// can tell whether the layout was user-authored (quilt_summarize.json) or
// auto-discovered, and skip the auto-discovered case if they choose.
export const bucketSummary = async ({
  s3,
  req,
  bucket,
  inStack,
  withSource = false,
}: BucketSummaryArgs) => {
  const wrap = (entries: any, fromQuiltSummarize: boolean) =>
    withSource ? { entries, fromQuiltSummarize } : entries

  const handle = await ensureQuiltSummarizeIsPresent({ s3, bucket })
  if (handle) {
    try {
      return wrap(await summarize({ s3, handle }), true)
    } catch (e) {
      const display = `${handle.bucket}/${handle.key}`
      // eslint-disable-next-line no-console
      console.log(`Unable to fetch configured summary from '${display}':`)
      // eslint-disable-next-line no-console
      console.error(e)
    }
  }
  return wrap(await bucketSummaryFallback({ s3, req, bucket, inStack }), false)
}

interface BucketReadmesArgs {
  s3: S3
  bucket: string
}

export const bucketReadmes = ({ s3, bucket }: BucketReadmesArgs) =>
  Promise.all(README_KEYS.map((key) => ensureObjectIsPresent({ s3, bucket, key }))).then(
    R.filter(Boolean),
  )

interface BucketImgsArgs {
  req: Req
  s3: S3
  bucket: string
  inStack: boolean
}

export const bucketImgs = async ({ req, s3, bucket, inStack }: BucketImgsArgs) => {
  if (inStack) {
    try {
      const qs = mkSearch({ action: 'images', index: bucket })
      const result = await req(`/search${qs}`)
      return Eff.pipe(
        result,
        R.pathOr([], ['aggregations', 'objects', 'buckets']),
        R.map((h: any) => {
          // eslint-disable-next-line no-underscore-dangle
          const s = h.latest.hits.hits[0]._source
          return { bucket, key: s.key, version: s.version_id }
        }),
        R.take(MAX_IMGS),
      )
    } catch (e) {
      // eslint-disable-next-line no-console
      console.log('Unable to fetch live images sample:')
      // eslint-disable-next-line no-console
      console.error(e)
    }
  }
  try {
    const result = await s3
      .listObjectsV2({ Bucket: bucket, EncodingType: 'url' })
      .promise()
    return Eff.pipe(
      result,
      R.path(['Contents']),
      R.map(R.evolve({ Key: decodeS3Key })) as (a: any) => any[],
      R.filter(
        (i: any) =>
          i.StorageClass !== 'GLACIER' &&
          i.StorageClass !== 'DEEP_ARCHIVE' &&
          !i.Key.startsWith('/') &&
          IMG_EXTS.some((e) => i.Key.toLowerCase().endsWith(e)),
      ),
      sampleSize(MAX_IMGS) as any,
      R.map(({ Key: key }: any) => ({ key, bucket })),
    )
  } catch (e) {
    // eslint-disable-next-line no-console
    console.log('Unable to fetch images sample from S3 listing:')
    // eslint-disable-next-line no-console
    console.error(e)
  }
  return []
}

const isFile = (fileHandle: any) => typeof fileHandle === 'string' || fileHandle.path

const isValidManifest = makeSchemaValidator(quiltSummarizeSchema as any)

type ResolvePath = (path: string) => Promise<any>

async function parseFile(resolvePath: ResolvePath, fileHandle: any) {
  const handle = await new Promise((resolve, reject) =>
    R.pipe(
      Resource.parse,
      Resource.Pointer.case({
        Web: () => null,
        S3: resolve,
        S3Rel: ((path: string) => resolvePath(path).then(resolve).catch(reject)) as any,
        Path: ((path: string) => resolvePath(path).then(resolve).catch(reject)) as any,
      }),
    )(fileHandle.path || fileHandle),
  )
  return {
    ...(typeof fileHandle === 'string' ? null : fileHandle),
    handle,
  }
}

interface SummarizeArgs {
  s3: S3
  handle: any
  resolveLogicalKey?: (logicalKey: string) => Promise<any>
}

export const summarize = async ({
  s3,
  handle: inputHandle,
  resolveLogicalKey,
}: SummarizeArgs) => {
  if (!inputHandle) return null
  const handle =
    resolveLogicalKey && inputHandle.logicalKey && !inputHandle.key
      ? await resolveLogicalKey(inputHandle.logicalKey)
      : inputHandle

  try {
    const file = await s3
      .getObject({
        Bucket: handle.bucket,
        Key: handle.key,
        VersionId: handle.version,
        // TODO: figure out caching issues
        IfMatch: handle.etag,
      })
      .promise()
    const json = file.Body!.toString('utf-8')
    const manifest = JSON.parse(json)
    const configErrors = isValidManifest(manifest)
    if (configErrors.length) {
      // eslint-disable-next-line no-console
      console.error(configErrors[0])
      throw new Error(
        'Invalid manifest: must be a JSON array of files or arrays of files',
      )
    }

    const resolvePath = async (path: string) => {
      const resolvedHandle = {
        bucket: handle.bucket,
        key: s3paths.resolveKey(handle.key, path),
      }

      if (resolveLogicalKey && handle.logicalKey) {
        try {
          const resolvedLogicalHandle = await resolveLogicalKey(
            s3paths.resolveKey(handle.logicalKey, path),
          )
          return resolvedLogicalHandle
        } catch (error) {
          // eslint-disable-next-line no-console
          console.warn('Error resolving logical key for summary', { handle, path })
          // eslint-disable-next-line no-console
          console.error(error)
          return {
            ...resolvedHandle,
            error,
          }
        }
      }

      return resolvedHandle
    }

    return await Promise.all(
      manifest.map((fileHandle: any) =>
        isFile(fileHandle)
          ? parseFile(resolvePath, fileHandle)
          : Promise.all(fileHandle.map(parseFile.bind(null, resolvePath))),
      ),
    )
  } catch (e) {
    // eslint-disable-next-line no-console
    console.log('Error loading summary:')
    // eslint-disable-next-line no-console
    console.error(e)
    throw e
  }
}

// const MANIFESTS_PREFIX = '.quilt/packages/'

// TODO: Preview endpoint only allows up to 512 lines right now. Increase it to 1000.
// const MAX_PACKAGE_ENTRIES = 500

// TODO: remove: used in a comented-out code in PackageList
// export const getRevisionData = async ({
//   endpoint,
//   sign,
//   bucket,
//   hash,
//   maxKeys = MAX_PACKAGE_ENTRIES,
// }) => {
//   const url = sign({ bucket, key: `${MANIFESTS_PREFIX}${hash}` })
//   const maxLines = maxKeys + 2 // 1 for the meta and 1 for checking overflow
//   const r = await fetch(
//     `${endpoint}/preview?url=${encodeURIComponent(url)}&input=txt&line_count=${maxLines}`,
//   )
//   const [header, ...entries] = await r
//     .json()
//     .then((json) => json.info.data.head.map((l) => JSON.parse(l)))
//   const files = Math.min(maxKeys, entries.length)
//   const bytes = entries.slice(0, maxKeys).reduce((sum, i) => sum + i.size, 0)
//   const truncated = entries.length > maxKeys
//   return {
//     stats: { files, bytes, truncated },
//     message: header.message,
//     header,
//   }
// }
