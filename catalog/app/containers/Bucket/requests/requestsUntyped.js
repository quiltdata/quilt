import { join as pathJoin } from 'path'

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

import { decodeS3Key } from './utils'

const promiseProps = (obj) =>
  Promise.all(Object.values(obj)).then(R.zipObj(Object.keys(obj)))

const parseDate = (d) => d && new Date(d)

const getOverviewBucket = (url) => s3paths.parseS3Url(url).bucket
const getOverviewPrefix = (url) => s3paths.parseS3Url(url).key
const getOverviewKey = (url, path) => pathJoin(getOverviewPrefix(url), path)

const processStats = R.applySpec({
  exts: R.pipe(
    R.path(['aggregations', 'exts', 'buckets']),
    R.map((i) => ({
      ext: i.key,
      objects: i.doc_count,
      bytes: i.size.value,
    })),
    R.sort(R.descend(R.prop('bytes'))),
  ),
  totalObjects: R.path(['hits', 'total']),
  totalBytes: R.path(['aggregations', 'totalBytes', 'value']),
})

export const bucketStats = async ({ req, s3, bucket, overviewUrl }) => {
  if (overviewUrl) {
    try {
      const r = await s3
        .getObject({
          Bucket: getOverviewBucket(overviewUrl),
          Key: getOverviewKey(overviewUrl, 'stats.json'),
        })
        .promise()
      return processStats(JSON.parse(r.Body.toString('utf-8')))
    } catch (e) {
      // eslint-disable-next-line no-console
      console.log(`Unable to fetch pre-rendered stats from '${overviewUrl}':`)
      // eslint-disable-next-line no-console
      console.error(e)
    }
  }

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

export async function getObjectExistence({ s3, bucket, key, version }) {
  const req = s3.headObject({ Bucket: bucket, Key: key, VersionId: version })
  try {
    const h = await req.promise()
    return ObjectExistence.Exists({
      bucket,
      key,
      version: h.VersionId,
      size: h.ContentLength,
      deleted: !!h.DeleteMarker,
      archived: h.StorageClass === 'GLACIER' || h.StorageClass === 'DEEP_ARCHIVE',
      lastModified: parseDate(h.LastModified),
    })
  } catch (e) {
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
      const { headers } = req.response.httpResponse
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

export const ensureObjectIsPresent = (...args) =>
  getObjectExistence(...args).then(
    ObjectExistence.case({
      Exists: ({ deleted, archived, ...h }) => (deleted || archived ? null : h),
      _: () => null,
    }),
  )

export const ensureQuiltSummarizeIsPresent = ({ s3, bucket }) =>
  ensureObjectIsPresent({ s3, bucket, key: SUMMARIZE_KEY })

export const bucketSummary = async ({ s3, req, bucket, overviewUrl, inStack }) => {
  const handle = await ensureQuiltSummarizeIsPresent({ s3, bucket })
  if (handle) {
    try {
      return await summarize({ s3, handle })
    } catch (e) {
      const display = `${handle.bucket}/${handle.key}`
      // eslint-disable-next-line no-console
      console.log(`Unable to fetch configured summary from '${display}':`)
      // eslint-disable-next-line no-console
      console.error(e)
    }
  }
  if (overviewUrl) {
    try {
      const r = await s3
        .getObject({
          Bucket: getOverviewBucket(overviewUrl),
          Key: getOverviewKey(overviewUrl, 'summary.json'),
        })
        .promise()
      return Eff.pipe(
        JSON.parse(r.Body.toString('utf-8')),
        R.pathOr([], ['aggregations', 'other', 'keys', 'buckets']),
        R.map((b) => ({
          bucket,
          key: b.key,
          // eslint-disable-next-line no-underscore-dangle
          version: b.latestVersion.hits.hits[0]._source.version_id,
          lastModified: parseDate(b.lastModified),
          // eslint-disable-next-line no-underscore-dangle
          ext: b.latestVersion.hits.hits[0]._source.ext,
        })),
        R.sortWith([
          R.ascend((h) => SAMPLE_EXTS.indexOf(h.ext)),
          R.descend(R.prop('lastModified')),
        ]),
        R.take(SAMPLE_SIZE),
        R.map(R.objOf('handle')),
      )
    } catch (e) {
      // eslint-disable-next-line no-console
      console.log(`Unable to fetch pre-rendered summary from '${overviewUrl}':`)
      // eslint-disable-next-line no-console
      console.error(e)
    }
  }
  if (inStack) {
    try {
      const qs = mkSearch({ action: 'sample', index: bucket })
      const result = await req(`/search${qs}`)
      return Eff.pipe(
        result,
        R.pathOr([], ['aggregations', 'objects', 'buckets']),
        R.map((h) => {
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
      R.map(R.evolve({ Key: decodeS3Key })),
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
      sampleSize(SAMPLE_SIZE),
      R.map(({ Key: key }) => ({ key, bucket })),
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

export const bucketReadmes = ({ s3, bucket, overviewUrl }) =>
  promiseProps({
    forced:
      overviewUrl &&
      ensureObjectIsPresent({
        s3,
        bucket: getOverviewBucket(overviewUrl),
        key: getOverviewKey(overviewUrl, 'README.md'),
      }),
    discovered: Promise.all(
      README_KEYS.map((key) => ensureObjectIsPresent({ s3, bucket, key })),
    ).then(R.filter(Boolean)),
  })

export const bucketImgs = async ({ req, s3, bucket, overviewUrl, inStack }) => {
  if (overviewUrl) {
    try {
      const r = await s3
        .getObject({
          Bucket: getOverviewBucket(overviewUrl),
          Key: getOverviewKey(overviewUrl, 'summary.json'),
        })
        .promise()
      return Eff.pipe(
        JSON.parse(r.Body.toString('utf-8')),
        R.pathOr([], ['aggregations', 'images', 'keys', 'buckets']),
        R.map((b) => ({
          bucket,
          key: b.key,
          // eslint-disable-next-line no-underscore-dangle
          version: b.latestVersion.hits.hits[0]._source.version_id,
        })),
      )
    } catch (e) {
      // eslint-disable-next-line no-console
      console.log(`Unable to fetch images sample from '${overviewUrl}':`)
      // eslint-disable-next-line no-console
      console.error(e)
    }
  }
  if (inStack) {
    try {
      const qs = mkSearch({ action: 'images', index: bucket })
      const result = await req(`/search${qs}`)
      return Eff.pipe(
        result,
        R.pathOr([], ['aggregations', 'objects', 'buckets']),
        R.map((h) => {
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
      R.map(R.evolve({ Key: decodeS3Key })),
      R.filter(
        (i) =>
          i.StorageClass !== 'GLACIER' &&
          i.StorageClass !== 'DEEP_ARCHIVE' &&
          !i.Key.startsWith('/') &&
          IMG_EXTS.some((e) => i.Key.toLowerCase().endsWith(e)),
      ),
      sampleSize(MAX_IMGS),
      R.map(({ Key: key }) => ({ key, bucket })),
    )
  } catch (e) {
    // eslint-disable-next-line no-console
    console.log('Unable to fetch images sample from S3 listing:')
    // eslint-disable-next-line no-console
    console.error(e)
  }
  return []
}

const isFile = (fileHandle) => typeof fileHandle === 'string' || fileHandle.path

const isValidManifest = makeSchemaValidator(quiltSummarizeSchema)

async function parseFile(resolvePath, fileHandle) {
  const handle = await new Promise((resolve, reject) =>
    R.pipe(
      Resource.parse,
      Resource.Pointer.case({
        Web: () => null,
        S3: resolve,
        S3Rel: (path) => resolvePath(path).then(resolve).catch(reject),
        Path: (path) => resolvePath(path).then(resolve).catch(reject),
      }),
    )(fileHandle.path || fileHandle),
  )
  return {
    ...(typeof fileHandle === 'string' ? null : fileHandle),
    handle,
  }
}

export const summarize = async ({ s3, handle: inputHandle, resolveLogicalKey }) => {
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
    const json = file.Body.toString('utf-8')
    const manifest = JSON.parse(json)
    const configErrors = isValidManifest(manifest)
    if (configErrors.length) {
      // eslint-disable-next-line no-console
      console.error(configErrors[0])
      throw new Error(
        'Invalid manifest: must be a JSON array of files or arrays of files',
      )
    }

    const resolvePath = async (path) => {
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
      manifest.map((fileHandle) =>
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
