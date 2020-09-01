import { join as pathJoin } from 'path'

import S3 from 'aws-sdk/clients/s3'
import * as dateFns from 'date-fns'
import sampleSize from 'lodash/fp/sampleSize'
import * as R from 'ramda'

import { SUPPORTED_EXTENSIONS as IMG_EXTS } from 'components/Thumbnail'
import { mkSearch } from 'utils/NamedRoutes'
import * as Resource from 'utils/Resource'
import * as s3paths from 'utils/s3paths'
import tagged from 'utils/tagged'

import * as errors from './errors'

const catchErrors = (pairs = []) =>
  R.cond([
    [
      R.propEq('message', 'Network Failure'),
      () => {
        throw new errors.CORSError()
      },
    ],
    [
      R.propEq('message', 'Access Denied'),
      () => {
        throw new errors.AccessDenied()
      },
    ],
    [
      R.propEq('code', 'Forbidden'),
      () => {
        throw new errors.AccessDenied()
      },
    ],
    [
      R.propEq('code', 'NoSuchBucket'),
      () => {
        throw new errors.NoSuchBucket()
      },
    ],
    ...pairs,
    [
      R.T,
      (e) => {
        throw e
      },
    ],
  ])

const withErrorHandling = (fn, pairs) => (...args) =>
  fn(...args).catch(catchErrors(pairs))

const promiseProps = (obj) =>
  Promise.all(Object.values(obj)).then(R.zipObj(Object.keys(obj)))

export const bucketListing = ({ s3, bucket, path = '', prev }) =>
  s3
    .listObjectsV2({
      Bucket: bucket,
      Delimiter: '/',
      Prefix: path,
      ContinuationToken: prev ? prev.continuationToken : undefined,
    })
    .promise()
    .then(
      R.applySpec({
        dirs: R.pipe(
          R.prop('CommonPrefixes'),
          R.pluck('Prefix'),
          R.filter((d) => d !== '/' && d !== '../'),
          (xs) => (prev && prev.dirs ? prev.dirs.concat(xs) : xs),
          R.uniq,
        ),
        files: R.pipe(
          R.prop('Contents'),
          // filter-out "directory-files" (files that match prefixes)
          R.filter(({ Key }) => Key !== path && !Key.endsWith('/')),
          R.map((i) => ({
            // TODO: expose VersionId?
            bucket,
            key: i.Key,
            modified: i.LastModified,
            size: i.Size,
            etag: i.ETag,
          })),
          (xs) => (prev && prev.files ? prev.files.concat(xs) : xs),
        ),
        truncated: R.prop('IsTruncated'),
        continuationToken: R.prop('NextContinuationToken'),
        bucket: () => bucket,
        path: () => path,
      }),
    )
    .catch(catchErrors())

const MAX_BANDS = 10

export const bucketAccessCounts = async ({
  s3,
  analyticsBucket,
  bucket,
  today,
  window,
}) => {
  if (!analyticsBucket) throw new Error('bucketAccessCounts: "analyticsBucket" required')

  const dates = R.unfold(
    (daysLeft) => daysLeft >= 0 && [dateFns.subDays(today, daysLeft), daysLeft - 1],
    window,
  )

  try {
    return await s3Select({
      s3,
      Bucket: analyticsBucket,
      Key: `${ACCESS_COUNTS_PREFIX}/Exts.csv`,
      Expression: `
        SELECT ext, counts FROM s3object
        WHERE eventname = 'GetObject'
        AND bucket = '${sqlEscape(bucket)}'
      `,
      InputSerialization: {
        CSV: {
          FileHeaderInfo: 'Use',
          AllowQuotedRecordDelimiter: true,
        },
      },
    }).then(
      R.pipe(
        R.map((r) => {
          const recordedCounts = JSON.parse(r.counts)
          const { counts, total } = dates.reduce(
            (acc, date) => {
              const value = recordedCounts[dateFns.format(date, 'yyyy-MM-dd')] || 0
              const sum = acc.total + value
              return {
                total: sum,
                counts: acc.counts.concat({ date, value, sum }),
              }
            },
            { total: 0, counts: [] },
          )
          return { ext: r.ext && `.${r.ext}`, total, counts }
        }),
        R.filter((i) => i.total),
        R.sort(R.descend(R.prop('total'))),
        R.applySpec({
          byExt: R.identity,
          byExtCollapsed: (bands) => {
            if (bands.length <= MAX_BANDS) return bands
            const [other, rest] = R.partition((b) => b.ext === '', bands)
            const [toKeep, toMerge] = R.splitAt(MAX_BANDS - 1, rest)
            const merged = [...other, ...toMerge].reduce((acc, band) => ({
              ext: '',
              total: acc.total + band.total,
              counts: R.zipWith(
                (a, b) => ({
                  date: a.date,
                  value: a.value + b.value,
                  sum: a.sum + b.sum,
                }),
                acc.counts,
                band.counts,
              ),
            }))
            return R.sort(R.descend(R.prop('total')), toKeep.concat(merged))
          },
          combined: {
            total: R.reduce((sum, { total }) => sum + total, 0),
            counts: R.pipe(
              R.pluck('counts'),
              R.transpose,
              R.map(
                R.reduce(
                  (acc, { date, value, sum }) => ({
                    date,
                    value: acc.value + value,
                    sum: acc.sum + sum,
                  }),
                  { value: 0, sum: 0 },
                ),
              ),
            ),
          },
        }),
      ),
    )
  } catch (e) {
    // eslint-disable-next-line no-console
    console.log('Unable to fetch bucket access counts:')
    // eslint-disable-next-line no-console
    console.error(e)
    return {
      byExt: [],
      byExtCollapsed: [],
      combined: { total: 0, counts: [] },
    }
  }
}

const parseDate = (d) => d && new Date(d)

export function bucketExists({ s3, bucket, cache }) {
  if (S3.prototype.bucketRegionCache[bucket]) return Promise.resolve()
  if (cache && cache[bucket]) return Promise.resolve()
  return s3
    .headBucket({ Bucket: bucket })
    .promise()
    .then(() => {
      // eslint-disable-next-line no-param-reassign
      if (cache) cache[bucket] = true
    })
    .catch(
      catchErrors([
        [
          R.propEq('code', 'NotFound'),
          () => {
            throw new errors.NoSuchBucket()
          },
        ],
      ]),
    )
}

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
  totalVersions: R.path(['hits', 'total']),
  totalBytes: R.path(['aggregations', 'totalBytes', 'value']),
})

export const bucketStats = async ({ es, s3, bucket, overviewUrl }) => {
  if (overviewUrl) {
    try {
      return await s3
        .getObject({
          Bucket: getOverviewBucket(overviewUrl),
          Key: getOverviewKey(overviewUrl, 'stats.json'),
        })
        .promise()
        .then((r) => JSON.parse(r.Body.toString('utf-8')))
        .then(processStats)
    } catch (e) {
      console.log(`Unable to fetch pre-rendered stats from '${overviewUrl}':`)
      console.error(e)
    }
  }

  try {
    return await es({ action: 'stats', index: bucket }).then(processStats)
  } catch (e) {
    console.log('Unable to fetch live stats:')
    console.error(e)
  }

  throw new Error('Stats unavailable')
}

const README_KEYS = ['README.md', 'README.txt', 'README.ipynb']
const SAMPLE_EXTS = [
  '.parquet',
  '.csv',
  '.tsv',
  '.txt',
  '.vcf',
  '.xls',
  '.xlsx',
  '.ipynb',
  '.md',
  '.json',
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
      deleted: !!h.DeleteMarker,
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

const ensureObjectIsPresent = (...args) =>
  getObjectExistence(...args).then(
    ObjectExistence.case({
      Exists: ({ deleted, ...h }) => (deleted ? null : h),
      _: () => null,
    }),
  )

export const bucketSummary = async ({ s3, es, bucket, overviewUrl, inStack }) => {
  const handle = await ensureObjectIsPresent({ s3, bucket, key: SUMMARIZE_KEY })
  if (handle) {
    try {
      return await summarize({ s3, handle })
    } catch (e) {
      const display = `${handle.bucket}/${handle.key}`
      console.log(`Unable to fetch configured summary from '${display}':`)
      console.error(e)
    }
  }
  if (overviewUrl) {
    try {
      return await s3
        .getObject({
          Bucket: getOverviewBucket(overviewUrl),
          Key: getOverviewKey(overviewUrl, 'summary.json'),
        })
        .promise()
        .then(
          R.pipe(
            (r) => JSON.parse(r.Body.toString('utf-8')),
            R.path(['aggregations', 'other', 'keys', 'buckets']),
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
          ),
        )
    } catch (e) {
      console.log(`Unable to fetch pre-rendered summary from '${overviewUrl}':`)
      console.error(e)
    }
  }
  if (inStack) {
    try {
      return await es({ action: 'sample', index: bucket }).then(
        R.pipe(
          R.path(['hits', 'hits']),
          R.map((h) => {
            // eslint-disable-next-line no-underscore-dangle
            const s = (h.inner_hits.latest.hits.hits[0] || {})._source
            return (
              s && {
                bucket,
                key: s.key,
                version: s.version_id,
              }
            )
          }),
          R.filter(Boolean),
          R.take(SAMPLE_SIZE),
        ),
      )
    } catch (e) {
      console.log('Unable to fetch live summary:')
      console.error(e)
    }
  }
  try {
    return await s3
      .listObjectsV2({ Bucket: bucket })
      .promise()
      .then(
        R.pipe(
          R.path(['Contents']),
          R.filter(
            R.propSatisfies(
              R.allPass([
                R.complement(R.startsWith('.quilt/')),
                R.complement(R.startsWith('/')),
                R.complement(R.endsWith(SUMMARIZE_KEY)),
                // eslint-disable-next-line no-underscore-dangle
                R.complement(R.includes(R.__, README_KEYS)),
                R.anyPass(SAMPLE_EXTS.map(R.unary(R.endsWith))),
              ]),
              'Key',
            ),
          ),
          sampleSize(SAMPLE_SIZE),
          R.map(({ Key: key }) => ({ key, bucket })),
        ),
      )
  } catch (e) {
    console.log('Unable to fetch summary from S3 listing:')
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

export const bucketImgs = async ({ es, s3, bucket, overviewUrl, inStack }) => {
  if (overviewUrl) {
    try {
      return await s3
        .getObject({
          Bucket: getOverviewBucket(overviewUrl),
          Key: getOverviewKey(overviewUrl, 'summary.json'),
        })
        .promise()
        .then(
          R.pipe(
            (r) => JSON.parse(r.Body.toString('utf-8')),
            R.path(['aggregations', 'images', 'keys', 'buckets']),
            R.map((b) => ({
              bucket,
              key: b.key,
              // eslint-disable-next-line no-underscore-dangle
              version: b.latestVersion.hits.hits[0]._source.version_id,
            })),
          ),
        )
    } catch (e) {
      console.log(`Unable to fetch images sample from '${overviewUrl}':`)
      console.error(e)
    }
  }
  if (inStack) {
    try {
      return await es({ action: 'images', index: bucket }).then(
        R.pipe(
          R.path(['hits', 'hits']),
          R.map((h) => {
            // eslint-disable-next-line no-underscore-dangle
            const s = (h.inner_hits.latest.hits.hits[0] || {})._source
            return (
              s && {
                bucket,
                key: s.key,
                version: s.version_id,
              }
            )
          }),
          R.filter(Boolean),
          R.take(MAX_IMGS),
        ),
      )
    } catch (e) {
      console.log('Unable to fetch live images sample:')
      console.error(e)
    }
  }
  try {
    return await s3
      .listObjectsV2({ Bucket: bucket })
      .promise()
      .then(
        R.pipe(
          R.path(['Contents']),
          R.filter(
            R.propSatisfies(
              R.allPass([
                R.complement(R.startsWith('/')),
                R.anyPass(IMG_EXTS.map(R.unary(R.endsWith))),
              ]),
              'Key',
            ),
          ),
          sampleSize(MAX_IMGS),
          R.map(({ Key: key }) => ({ key, bucket })),
        ),
      )
  } catch (e) {
    console.log('Unable to fetch images sample from S3 listing:')
    console.error(e)
  }
  return []
}

export const objectVersions = ({ s3, bucket, path }) =>
  s3
    .listObjectVersions({ Bucket: bucket, Prefix: path })
    .promise()
    .then(
      R.pipe(
        ({ Versions, DeleteMarkers }) => Versions.concat(DeleteMarkers),
        R.filter((v) => v.Key === path),
        R.map((v) => ({
          isLatest: v.IsLatest || false,
          lastModified: v.LastModified,
          size: v.Size,
          id: v.VersionId,
          deleteMarker: v.Size == null,
        })),
        R.sort(R.descend(R.prop('lastModified'))),
      ),
    )

export const objectMeta = ({ s3, bucket, path, version }) =>
  s3
    .headObject({
      Bucket: bucket,
      Key: path,
      VersionId: version,
    })
    .promise()
    .then(R.pipe(R.path(['Metadata', 'helium']), R.when(Boolean, JSON.parse)))

const isValidManifest = R.both(Array.isArray, R.all(R.is(String)))

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
    if (!isValidManifest(manifest)) {
      throw new Error('Invalid manifest: must be a JSON array of file links')
    }

    const resolvePath = (path) =>
      resolveLogicalKey && handle.logicalKey
        ? resolveLogicalKey(s3paths.resolveKey(handle.logicalKey, path)).catch((e) => {
            console.warn('Error resolving logical key for summary', { handle, path })
            console.error(e)
            return null
          })
        : {
            bucket: handle.bucket,
            key: s3paths.resolveKey(handle.key, path),
          }

    const handles = await Promise.all(
      manifest.map(
        R.pipe(
          Resource.parse,
          Resource.Pointer.case({
            Web: () => null, // web urls are not supported in this context
            S3: R.identity,
            S3Rel: resolvePath,
            Path: resolvePath,
          }),
        ),
      ),
    )
    return handles.filter((h) => h)
  } catch (e) {
    // eslint-disable-next-line no-console
    console.log('Error loading summary:')
    // eslint-disable-next-line no-console
    console.error(e)
    return []
  }
}

const PACKAGES_PREFIX = '.quilt/named_packages/'
const MANIFESTS_PREFIX = '.quilt/packages/'

const fetchPackagesAccessCounts = async ({
  s3,
  analyticsBucket,
  bucket,
  today,
  window,
}) => {
  try {
    const records = await s3Select({
      s3,
      Bucket: analyticsBucket,
      Key: `${ACCESS_COUNTS_PREFIX}/Packages.csv`,
      Expression: `
        SELECT name, counts FROM s3object
        WHERE eventname = 'GetObject'
        AND bucket = '${sqlEscape(bucket)}'
      `,
      InputSerialization: {
        CSV: {
          FileHeaderInfo: 'Use',
          AllowQuotedRecordDelimiter: true,
        },
      },
    })

    return records.reduce((acc, r) => {
      const recordedCounts = JSON.parse(r.counts)

      const counts = R.times((i) => {
        const date = dateFns.subDays(today, window - i - 1)
        return {
          date,
          value: recordedCounts[dateFns.format(date, 'yyyy-MM-dd')] || 0,
        }
      }, window)

      const total = Object.values(recordedCounts).reduce(R.add, 0)

      return { ...acc, [r.name]: { counts, total } }
    }, {})
  } catch (e) {
    // eslint-disable-next-line no-console
    console.log('fetchPackagesAccessCounts : error caught')
    // eslint-disable-next-line no-console
    console.error(e)
    return {}
  }
}

const mkFilterQuery = (filter) =>
  filter
    ? {
        wildcard: {
          handle: {
            value: filter.includes('*') ? filter : `*${filter}*`,
          },
        },
      }
    : { match_all: {} }

export const countPackages = withErrorHandling(async ({ req, bucket, filter }) => {
  const body = {
    query: mkFilterQuery(filter),
    aggs: {
      total: {
        cardinality: { field: 'handle' },
      },
    },
  }
  const result = await req('/search', {
    index: `${bucket}_packages`,
    action: 'packages',
    body: JSON.stringify(body),
    size: 0,
  })
  return result.aggregations.total.value
})

export const listPackages = withErrorHandling(
  async ({
    req,
    s3,
    analyticsBucket,
    bucket,
    filter,
    sort = 'name', // name | modified
    perPage = 30,
    page = 1,
    today,
    analyticsWindow = 30,
  }) => {
    const countsP =
      analyticsBucket &&
      fetchPackagesAccessCounts({
        s3,
        analyticsBucket,
        bucket,
        today,
        window: analyticsWindow,
      })

    const body = {
      query: mkFilterQuery(filter),
      aggs: {
        packages: {
          composite: {
            // the limit is configured in ES cluster settings (search.max_buckets)
            size: 10000,
            sources: [
              {
                handle: {
                  terms: { field: 'handle' },
                },
              },
            ],
          },
          aggs: {
            modified: {
              max: { field: 'last_modified' },
            },
            sort: {
              bucket_sort: {
                sort: sort === 'modified' ? [{ modified: { order: 'desc' } }] : undefined,
                size: perPage,
                from: perPage * (page - 1),
              },
            },
          },
        },
      },
    }
    const result = await req('/search', {
      index: `${bucket}_packages`,
      action: 'packages',
      body: JSON.stringify(body),
      size: 0,
    })
    const packages = result.aggregations.packages.buckets.map((b) => ({
      name: b.key.handle,
      modified: new Date(b.modified.value),
      revisions: b.doc_count,
    }))

    if (!countsP) return packages
    const counts = await countsP
    return packages.map((p) => ({ ...p, views: counts[p.name] }))
  },
)

const getRevisionIdFromKey = (key) => key.substring(key.lastIndexOf('/') + 1)
const getRevisionKeyFromId = (name, id) => `${PACKAGES_PREFIX}${name}/${id}`

const fetchRevisionsAccessCounts = async ({
  s3,
  analyticsBucket,
  bucket,
  name,
  today,
  window,
}) => {
  try {
    const records = await s3Select({
      s3,
      Bucket: analyticsBucket,
      Key: `${ACCESS_COUNTS_PREFIX}/PackageVersions.csv`,
      Expression: `
        SELECT hash, counts FROM s3object
        WHERE eventname = 'GetObject'
        AND bucket = '${sqlEscape(bucket)}'
        AND name = '${sqlEscape(name)}'
      `,
      InputSerialization: {
        CSV: {
          FileHeaderInfo: 'Use',
          AllowQuotedRecordDelimiter: true,
        },
      },
    })

    return records.reduce((acc, r) => {
      const recordedCounts = JSON.parse(r.counts)

      const counts = R.times((i) => {
        const date = dateFns.subDays(today, window - i - 1)
        return {
          date,
          value: recordedCounts[dateFns.format(date, 'yyyy-MM-dd')] || 0,
        }
      }, window)

      const total = Object.values(recordedCounts).reduce(R.add, 0)

      return { ...acc, [r.hash]: { counts, total } }
    }, {})
  } catch (e) {
    // eslint-disable-next-line no-console
    console.log('fetchRevisionsAccessCounts : error caught')
    // eslint-disable-next-line no-console
    console.error(e)
    return {}
  }
}

const MAX_DRAIN_REQUESTS = 10

const drainObjectList = async ({ s3, Bucket, ...params }) => {
  let reqNo = 0
  let Contents = []
  let CommonPrefixes = []
  let ContinuationToken
  // eslint-disable-next-line no-constant-condition
  while (true) {
    // eslint-disable-next-line no-await-in-loop
    const r = await s3.listObjectsV2({ Bucket, ContinuationToken, ...params }).promise()
    Contents = Contents.concat(r.Contents)
    CommonPrefixes = CommonPrefixes.concat(r.CommonPrefixes)
    reqNo += 1
    if (!r.IsTruncated || reqNo >= MAX_DRAIN_REQUESTS)
      return { ...r, Contents, CommonPrefixes }
    ContinuationToken = r.NextContinuationToken
  }
}

export const getPackageRevisions = withErrorHandling(
  async ({ s3, analyticsBucket, bucket, name, today, analyticsWindow = 30 }) => {
    const countsP = analyticsBucket
      ? fetchRevisionsAccessCounts({
          s3,
          analyticsBucket,
          bucket,
          name,
          today,
          window: analyticsWindow,
        })
      : Promise.resolve({})
    let latestFound = false
    const { revisions, isTruncated } = await drainObjectList({
      s3,
      Bucket: bucket,
      Prefix: `${PACKAGES_PREFIX}${name}/`,
    }).then((r) => ({
      revisions: r.Contents.reduce((acc, { Key: key }) => {
        const id = getRevisionIdFromKey(key)
        if (id === 'latest') {
          latestFound = true
          return acc
        }
        return [id, ...acc]
      }, []),
      isTruncated: r.IsTruncated,
    }))
    if (latestFound) revisions.unshift('latest')
    if (!revisions.length) throw new errors.NoSuchPackage()
    return { revisions, isTruncated, counts: await countsP }
  },
)

export const loadRevisionHash = ({ s3, bucket, name, id }) =>
  s3
    .getObject({ Bucket: bucket, Key: getRevisionKeyFromId(name, id) })
    .promise()
    .then((res) => ({
      modified: res.LastModified,
      hash: res.Body.toString('utf-8'),
    }))

// TODO: Preview endpoint only allows up to 512 lines right now. Increase it to 1000.
const MAX_PACKAGE_ENTRIES = 500

export const getRevisionData = async ({
  s3,
  endpoint,
  sign,
  bucket,
  name,
  id,
  maxKeys = MAX_PACKAGE_ENTRIES,
}) => {
  const { hash, modified } = await loadRevisionHash({ s3, bucket, name, id })
  const manifestKey = `${MANIFESTS_PREFIX}${hash}`
  const url = sign({ bucket, key: manifestKey })
  const maxLines = maxKeys + 2 // 1 for the meta and 1 for checking overflow
  const r = await fetch(
    `${endpoint}/preview?url=${encodeURIComponent(url)}&input=txt&line_count=${maxLines}`,
  )
  const [header, ...entries] = await r
    .json()
    .then((json) => json.info.data.head.map((l) => JSON.parse(l)))
  const files = Math.min(maxKeys, entries.length)
  const bytes = entries.slice(0, maxKeys).reduce((sum, i) => sum + i.size, 0)
  const truncated = entries.length > maxKeys
  return {
    hash,
    modified,
    stats: { files, bytes, truncated },
    message: header.message,
    header,
  }
}

const s3Select = ({
  s3,
  ExpressionType = 'SQL',
  InputSerialization = { JSON: { Type: 'LINES' } },
  ...rest
}) =>
  s3
    .selectObjectContent({
      ExpressionType,
      InputSerialization,
      OutputSerialization: { JSON: {} },
      ...rest,
    })
    .promise()
    .then(
      R.pipe(
        R.prop('Payload'),
        R.reduce((acc, evt) => {
          if (!evt.Records) return acc
          const s = evt.Records.Payload.toString()
          return acc + s
        }, ''),
        R.trim,
        R.ifElse(R.isEmpty, R.always([]), R.pipe(R.split('\n'), R.map(JSON.parse))),
      ),
    )

export async function packageSelect({
  s3,
  credentials,
  endpoint,
  bucket,
  name,
  revision,
  ...args
}) {
  const { hash } = await loadRevisionHash({ s3, bucket, name, id: revision })
  const manifest = `${MANIFESTS_PREFIX}${hash}`

  await credentials.getPromise()

  const r = await fetch(
    `${endpoint}/pkgselect${mkSearch({
      bucket,
      manifest,
      access_key: credentials.accessKeyId,
      secret_key: credentials.secretAccessKey,
      session_token: credentials.sessionToken,
      ...args,
    })}`,
  )

  if (r.status >= 400) {
    const msg = await r.text()
    throw new errors.BucketError(msg, { status: r.status })
  }

  const { contents: data } = await r.json()
  return data
}

export async function packageFileDetail({ path, ...args }) {
  const r = await packageSelect({ logical_key: path, ...args })
  return {
    ...s3paths.parseS3Url(r.physical_keys[0]),
    size: r.size,
    logicalKey: r.logical_key,
  }
}

const sqlEscape = (arg) => arg.replace(/'/g, "''")

const ACCESS_COUNTS_PREFIX = 'AccessCounts'

const queryAccessCounts = async ({
  s3,
  analyticsBucket,
  type,
  query,
  today,
  window = 365,
}) => {
  try {
    const records = await s3Select({
      s3,
      Bucket: analyticsBucket,
      Key: `${ACCESS_COUNTS_PREFIX}/${type}.csv`,
      Expression: query,
      InputSerialization: {
        CSV: {
          FileHeaderInfo: 'Use',
          AllowQuotedRecordDelimiter: true,
        },
      },
    })

    const recordedCounts = records.length ? JSON.parse(records[0].counts) : {}

    const counts = R.times((i) => {
      const date = dateFns.subDays(today, window - i - 1)
      return {
        date,
        value: recordedCounts[dateFns.format(date, 'yyyy-MM-dd')] || 0,
      }
    }, window)

    const total = Object.values(recordedCounts).reduce(R.add, 0)

    return { counts, total }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.log('queryAccessCounts: error caught')
    // eslint-disable-next-line no-console
    console.error(e)
    throw e
  }
}

export const objectAccessCounts = ({ s3, analyticsBucket, bucket, path, today }) =>
  queryAccessCounts({
    s3,
    analyticsBucket,
    type: 'Objects',
    query: `
      SELECT counts FROM s3object
      WHERE eventname = 'GetObject'
      AND bucket = '${sqlEscape(bucket)}'
      AND "key" = '${sqlEscape(path)}'
    `,
    today,
    window: 365,
  })
