import * as dateFns from 'date-fns'
import sampleSize from 'lodash/fp/sampleSize'
import * as R from 'ramda'

import { SUPPORTED_EXTENSIONS as IMG_EXTS } from 'components/Thumbnail'
import { resolveKey } from 'utils/s3paths'
import * as Resource from 'utils/Resource'

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

const mapAllP = R.curry((fn, list) => Promise.all(list.map(fn)))

const mergeAllP = (...ps) => Promise.all(ps).then(R.mergeAll)

const promiseProps = (obj) =>
  Promise.all(Object.values(obj)).then(R.zipObj(Object.keys(obj)))

export const bucketListing = ({ s3req, bucket, path = '' }) =>
  s3req({
    bucket,
    operation: 'listObjectsV2',
    params: {
      Bucket: bucket,
      Delimiter: '/',
      Prefix: path,
    },
  })
    .then(
      R.applySpec({
        dirs: R.pipe(
          R.prop('CommonPrefixes'),
          R.pluck('Prefix'),
          R.filter((d) => d !== '/' && d !== '../'),
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
        ),
        truncated: R.prop('IsTruncated'),
        bucket: () => bucket,
        path: () => path,
      }),
    )
    .catch(catchErrors())

const MAX_BANDS = 10

export const bucketAccessCounts = async ({
  s3req,
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
      s3req,
      Bucket: analyticsBucket,
      Key: `${ACCESS_COUNTS_PREFIX}/Exts.csv`,
      Expression: `
        SELECT ext, counts FROM s3object
        WHERE eventname = 'GetObject'
        AND bucket = '${sqlEscape(bucket)}'
      `,
      InputSerialization: { CSV: { FileHeaderInfo: 'Use' } },
    }).then(
      R.pipe(
        R.map((r) => {
          const recordedCounts = JSON.parse(r.counts)
          const { counts, total } = dates.reduce(
            (acc, date) => {
              const value = recordedCounts[dateFns.format(date, 'YYYY-MM-DD')] || 0
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
    return []
  }
}

const parseDate = (d) => d && new Date(d)

export const bucketExists = ({ s3req, bucket }) =>
  s3req({ bucket, operation: 'headBucket', params: { Bucket: bucket } }).catch(
    catchErrors([
      [
        R.propEq('code', 'NotFound'),
        () => {
          throw new errors.NoSuchBucket()
        },
      ],
    ]),
  )

const S3_REGEXP = /s3:\/\/(?<bucket>[^/]+)\/(?<path>.*)/

const getOverviewBucket = (url) => url.match(S3_REGEXP).groups.bucket
const getOverviewPath = (url) => url.match(S3_REGEXP).groups.path

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

export const bucketStats = async ({ es, s3req, bucket, overviewUrl }) => {
  if (overviewUrl) {
    try {
      return await s3req({
        bucket: getOverviewBucket(overviewUrl),
        operation: 'getObject',
        params: {
          Bucket: getOverviewBucket(overviewUrl),
          Key: `${unescape(getOverviewPath(overviewUrl))}/stats.json`,
        },
      })
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
const SAMPLE_SIZE = 10
const SUMMARIZE_KEY = 'quilt_summarize.json'
const MAX_IMGS = 100

const headObject = ({ s3req, bucket, key }) =>
  s3req({
    bucket,
    operation: 'headObject',
    params: { Bucket: bucket, Key: key },
  })
    .then((h) => (h.DeleteMarker ? null : { bucket, key, version: h.VersionId }))
    .catch((e) => {
      if (e.code === 'NotFound') return null
      throw e
    })

export const bucketSummary = async ({ s3req, es, bucket, overviewUrl, inStack }) => {
  const handle = await headObject({ s3req, bucket, key: SUMMARIZE_KEY })
  if (handle) {
    try {
      return await summarize({ s3req, handle })
    } catch (e) {
      const display = `${handle.bucket}/${handle.key}`
      console.log(`Unable to fetch configured summary from '${display}':`)
      console.error(e)
    }
  }
  if (overviewUrl) {
    try {
      return await s3req({
        bucket: getOverviewBucket(overviewUrl),
        operation: 'getObject',
        params: {
          Bucket: getOverviewBucket(overviewUrl),
          Key: `${unescape(getOverviewPath(overviewUrl))}/summary.json`,
        },
      }).then(
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
    return await s3req({
      bucket,
      operation: 'listObjectsV2',
      params: { Bucket: bucket },
    }).then(
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

export const bucketReadmes = ({ s3req, bucket, overviewUrl }) =>
  promiseProps({
    forced:
      overviewUrl &&
      headObject({
        s3req,
        bucket: getOverviewBucket(overviewUrl),
        key: `${unescape(getOverviewPath(overviewUrl))}/README.md`,
      }),
    discovered: Promise.all(
      README_KEYS.map((key) => headObject({ s3req, bucket, key })),
    ).then(R.filter(Boolean)),
  })

export const bucketImgs = async ({ es, s3req, bucket, overviewUrl, inStack }) => {
  if (overviewUrl) {
    try {
      return await s3req({
        bucket: getOverviewBucket(overviewUrl),
        operation: 'getObject',
        params: {
          Bucket: getOverviewBucket(overviewUrl),
          Key: `${unescape(getOverviewPath(overviewUrl))}/summary.json`,
        },
      }).then(
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
    return await s3req({
      bucket,
      operation: 'listObjectsV2',
      params: { Bucket: bucket },
    }).then(
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

export const objectVersions = ({ s3req, bucket, path }) =>
  s3req({
    bucket,
    operation: 'listObjectVersions',
    params: { Bucket: bucket, Prefix: path },
  }).then(
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

export const objectMeta = ({ s3req, bucket, path, version }) =>
  s3req({
    bucket,
    operation: 'headObject',
    params: {
      Bucket: bucket,
      Key: path,
      VersionId: version,
    },
  }).then(R.pipe(R.path(['Metadata', 'helium']), R.when(Boolean, JSON.parse)))

const isValidManifest = R.both(Array.isArray, R.all(R.is(String)))

export const summarize = async ({ s3req, handle }) => {
  if (!handle) return null

  try {
    const file = await s3req({
      bucket: handle.bucket,
      operation: 'getObject',
      params: {
        Bucket: handle.bucket,
        Key: handle.key,
        VersionId: handle.version,
        // TODO: figure out caching issues
        IfMatch: handle.etag,
      },
    })
    const json = file.Body.toString('utf-8')
    const manifest = JSON.parse(json)
    if (!isValidManifest(manifest)) {
      throw new Error('Invalid manifest: must be a JSON array of file links')
    }

    const resolvePath = (path) => ({
      bucket: handle.bucket,
      key: resolveKey(handle.key, path),
    })

    // TODO: figure out versions of package-local referenced objects
    return manifest
      .map(
        R.pipe(
          Resource.parse,
          Resource.Pointer.case({
            Web: () => null, // web urls are not supported in this context
            S3: R.identity,
            S3Rel: resolvePath,
            Path: resolvePath,
          }),
        ),
      )
      .filter((h) => h)
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
const MAX_REVISIONS = 100

const fetchPackagesAccessCounts = async ({
  s3req,
  analyticsBucket,
  bucket,
  today,
  window,
}) => {
  try {
    const records = await s3Select({
      s3req,
      Bucket: analyticsBucket,
      Key: `${ACCESS_COUNTS_PREFIX}/Packages.csv`,
      Expression: `
        SELECT name, counts FROM s3object
        WHERE eventname = 'GetObject'
        AND bucket = '${sqlEscape(bucket)}'
      `,
      InputSerialization: { CSV: { FileHeaderInfo: 'Use' } },
    })

    return records.reduce((acc, r) => {
      const recordedCounts = JSON.parse(r.counts)

      const counts = R.times((i) => {
        const date = dateFns.subDays(today, window - i - 1)
        return {
          date,
          value: recordedCounts[dateFns.format(date, 'YYYY-MM-DD')] || 0,
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

const listPackageOwnerPrefixes = ({ s3req, bucket }) =>
  s3req({
    bucket,
    operation: 'listObjectsV2',
    params: { Bucket: bucket, Prefix: PACKAGES_PREFIX, Delimiter: '/' },
  }).then((r) => r.CommonPrefixes.map((p) => p.Prefix))

const listPackagePrefixes = ({ s3req, bucket, ownerPrefix }) =>
  s3req({
    bucket,
    operation: 'listObjectsV2',
    params: { Bucket: bucket, Prefix: ownerPrefix, Delimiter: '/' },
  }).then((r) => r.CommonPrefixes.map((p) => p.Prefix))

const fetchPackageLatest = ({ s3req, bucket, prefix }) =>
  s3req({
    bucket,
    operation: 'listObjectsV2',
    params: { Bucket: bucket, Prefix: `${prefix}latest` },
  }).then(({ Contents: [latest] }) => {
    const name = prefix.slice(PACKAGES_PREFIX.length, -1)
    if (!latest) {
      // eslint-disable-next-line no-console
      console.warn(
        `Unable to get latest revision: missing 'latest' file under the '${PACKAGES_PREFIX}${name}/' prefix`,
      )
    }
    return {
      name,
      modified: latest ? latest.LastModified : null,
    }
  })

const fetchPackageRevisions = ({ s3req, bucket, prefix }) =>
  s3req({
    bucket,
    operation: 'listObjectsV2',
    params: {
      Bucket: bucket,
      Prefix: prefix,
      MaxKeys: MAX_REVISIONS + 1, // 1 for `latest`
    },
  }).then(({ Contents, IsTruncated }) => ({
    revisions: Contents.length - 1,
    revisionsTruncated: IsTruncated,
  }))

export const listPackages = withErrorHandling(
  async ({ s3req, analyticsBucket, bucket, today, analyticsWindow = 30 }) => {
    const countsP =
      analyticsBucket &&
      fetchPackagesAccessCounts({
        s3req,
        analyticsBucket,
        bucket,
        today,
        window: analyticsWindow,
      })
    const packages = await listPackageOwnerPrefixes({ s3req, bucket })
      .then(
        mapAllP((ownerPrefix) =>
          listPackagePrefixes({ s3req, bucket, ownerPrefix }).then(
            mapAllP((prefix) =>
              mergeAllP(
                fetchPackageLatest({ s3req, bucket, prefix }),
                fetchPackageRevisions({ s3req, bucket, prefix }),
              ),
            ),
          ),
        ),
      )
      .then(R.unnest)
    if (!countsP) return packages
    const counts = await countsP
    return packages.map((p) => ({ ...p, views: counts[p.name] }))
  },
)

const getRevisionIdFromKey = (key) => key.substring(key.lastIndexOf('/') + 1)
const getRevisionKeyFromId = (name, id) => `${PACKAGES_PREFIX}${name}/${id}`

const fetchRevisionsAccessCounts = async ({
  s3req,
  analyticsBucket,
  bucket,
  name,
  today,
  window,
}) => {
  try {
    const records = await s3Select({
      s3req,
      Bucket: analyticsBucket,
      Key: `${ACCESS_COUNTS_PREFIX}/PackageVersions.csv`,
      Expression: `
        SELECT hash, counts FROM s3object
        WHERE eventname = 'GetObject'
        AND bucket = '${sqlEscape(bucket)}'
        AND name = '${sqlEscape(name)}'
      `,
      InputSerialization: { CSV: { FileHeaderInfo: 'Use' } },
    })

    return records.reduce((acc, r) => {
      const recordedCounts = JSON.parse(r.counts)

      const counts = R.times((i) => {
        const date = dateFns.subDays(today, window - i - 1)
        return {
          date,
          value: recordedCounts[dateFns.format(date, 'YYYY-MM-DD')] || 0,
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

const drainObjectList = async ({ s3req, bucket, prefix }) => {
  let reqNo = 0
  let Contents = []
  let ContinuationToken
  while (true) {
    // eslint-disable-next-line no-await-in-loop
    const r = await s3req({
      bucket,
      operation: 'listObjectsV2',
      params: { Bucket: bucket, Prefix: prefix, ContinuationToken },
    })
    Contents = Contents.concat(r.Contents)
    reqNo += 1
    if (!r.IsTruncated || reqNo >= MAX_DRAIN_REQUESTS) return { ...r, Contents }
    ContinuationToken = r.NextContinuationToken
  }
}

export const getPackageRevisions = withErrorHandling(
  async ({ s3req, analyticsBucket, bucket, name, today, analyticsWindow = 30 }) => {
    const countsP = analyticsBucket
      ? fetchRevisionsAccessCounts({
          s3req,
          analyticsBucket,
          bucket,
          name,
          today,
          window: analyticsWindow,
        })
      : Promise.resolve({})
    const { revisions, isTruncated } = await drainObjectList({
      s3req,
      bucket,
      prefix: `${PACKAGES_PREFIX}${name}/`,
    }).then((r) => ({
      revisions: r.Contents.reduce((acc, { Key: key }) => {
        const id = getRevisionIdFromKey(key)
        if (id === 'latest') return acc
        return [id, ...acc]
      }, []),
      isTruncated: r.IsTruncated,
    }))
    revisions.unshift('latest')
    return { revisions, isTruncated, counts: await countsP }
  },
)

const loadRevisionHash = ({ s3req, bucket, name, id }) =>
  s3req({
    bucket,
    operation: 'getObject',
    params: { Bucket: bucket, Key: getRevisionKeyFromId(name, id) },
  }).then((res) => ({
    modified: res.LastModified,
    hash: res.Body.toString('utf-8'),
  }))

export const getRevisionData = async ({
  s3req,
  endpoint,
  signer,
  bucket,
  name,
  id,
  maxKeys = MAX_PACKAGE_ENTRIES,
}) => {
  const { hash, modified } = await loadRevisionHash({ s3req, bucket, name, id })
  const manifestKey = `${MANIFESTS_PREFIX}${hash}`
  const url = signer.getSignedS3URL({ bucket, key: manifestKey })
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
  s3req,
  ExpressionType = 'SQL',
  InputSerialization = { JSON: { Type: 'LINES' } },
  ...rest
}) =>
  s3req({
    bucket: rest.Bucket,
    operation: 'selectObjectContent',
    params: {
      ExpressionType,
      InputSerialization,
      OutputSerialization: { JSON: {} },
      ...rest,
    },
  }).then(
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

// TODO: Preview endpoint only allows up to 512 lines right now. Increase it to 1000.
const MAX_PACKAGE_ENTRIES = 500

export const fetchPackageTree = withErrorHandling(
  async ({ s3req, sign, endpoint, bucket, name, revision }) => {
    const { hash } = await loadRevisionHash({ s3req, bucket, name, id: revision })
    const manifestKey = `${MANIFESTS_PREFIX}${hash}`

    // We skip the first line - it contains the manifest version, etc.
    // We also request one more line than we need to decide if the results are truncated.
    const maxLines = MAX_PACKAGE_ENTRIES + 2

    const url = sign({ bucket, key: manifestKey })
    const encodedUrl = encodeURIComponent(url)
    const r = await fetch(
      `${endpoint}/preview?url=${encodedUrl}&input=txt&line_count=${maxLines}`,
    )
    const json = await r.json()
    const lines = json.info.data.head
    const truncated = lines.length >= maxLines
    const keys = lines.slice(1, maxLines - 1).map((line) => {
      const {
        logical_key: logicalKey,
        physical_keys: [physicalKey],
        size,
      } = JSON.parse(line)
      return { logicalKey, physicalKey, size }
    })
    return { id: revision, hash, keys, truncated }
  },
)

const sqlEscape = (arg) => arg.replace(/'/g, "''")

const ACCESS_COUNTS_PREFIX = 'AccessCounts'

const queryAccessCounts = async ({
  s3req,
  analyticsBucket,
  type,
  query,
  today,
  window = 365,
}) => {
  try {
    const records = await s3Select({
      s3req,
      Bucket: analyticsBucket,
      Key: `${ACCESS_COUNTS_PREFIX}/${type}.csv`,
      Expression: query,
      InputSerialization: { CSV: { FileHeaderInfo: 'Use' } },
    })

    const recordedCounts = records.length ? JSON.parse(records[0].counts) : {}

    const counts = R.times((i) => {
      const date = dateFns.subDays(today, window - i - 1)
      return {
        date,
        value: recordedCounts[dateFns.format(date, 'YYYY-MM-DD')] || 0,
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

export const objectAccessCounts = ({ s3req, analyticsBucket, bucket, path, today }) =>
  queryAccessCounts({
    s3req,
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
