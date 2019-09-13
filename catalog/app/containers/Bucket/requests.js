import * as dateFns from 'date-fns'
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

export const bucketAccessCounts = async ({
  s3req,
  analyticsBucket,
  bucket,
  today,
  window,
}) => {
  if (!analyticsBucket) return {}
  try {
    const records = await s3Select({
      s3req,
      Bucket: analyticsBucket,
      Key: `${ACCESS_COUNTS_PREFIX}/Exts.csv`,
      Expression: `
        SELECT ext, counts FROM s3object
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

      return { ...acc, [r.ext]: counts }
    }, {})
  } catch (e) {
    // eslint-disable-next-line no-console
    console.log('fetchBucketAccessCounts: error caught')
    // eslint-disable-next-line no-console
    console.error(e)
    return {}
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

export const bucketStats = async ({ es, maxExts }) => {
  const r = await es({
    query: { match_all: {} },
    size: 0,
    aggs: {
      totalBytes: { sum: { field: 'size' } },
      exts: {
        terms: { field: 'ext' },
        aggs: { size: { sum: { field: 'size' } } },
      },
      updated: { max: { field: 'updated' } },
    },
  })

  const exts = R.pipe(
    R.map((i) => ({
      ext: i.key,
      objects: i.doc_count,
      bytes: i.size.value,
    })),
    R.sort(R.descend(R.prop('bytes'))),
    R.slice(0, maxExts),
  )(r.aggregations.exts.buckets)

  return {
    totalObjects: r.hits.total,
    totalVersions: r.hits.total,
    totalBytes: r.aggregations.totalBytes.value,
    updated: parseDate(r.aggregations.updated.value_as_string),
    exts,
  }
}

const parseVersion = R.when(R.equals('null'), () => undefined)

const DELETED = Symbol('DELETED')

const extractLatestVersion = (hits) => {
  const totalVersions = hits.total
  // eslint-disable-next-line no-underscore-dangle
  const latestVersion = parseVersion(hits.hits[0]._source.version_id)
  return (
    latestVersion ||
    (totalVersions === 1
      ? // single version and it's null -> versioning disabled
        undefined
      : // latest version is null -> object deleted
        DELETED)
  )
}

const MAX_IMGS = 100
const README_KEYS = ['README.md', 'README.txt', 'README.ipynb']
const MAX_OTHER = 10
const OTHER_EXTS = [
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
const SUMMARIZE_KEY = 'quilt_summarize.json'

export const bucketSummary = ({ es, bucket }) =>
  es({
    query: { match_all: {} },
    aggs: {
      readmes: {
        terms: {
          field: 'key',
          include: README_KEYS,
        },
        aggs: {
          latestVersion: {
            top_hits: {
              sort: [{ last_modified: { order: 'desc' } }],
              _source: ['version_id'],
              size: 1,
            },
          },
        },
      },
      images: {
        filter: {
          terms: { ext: IMG_EXTS },
        },
        aggs: {
          keys: {
            terms: {
              field: 'key',
              size: MAX_IMGS,
              order: { 'lastModified.value': 'desc' },
            },
            aggs: {
              latestVersion: {
                top_hits: {
                  sort: [{ last_modified: { order: 'desc' } }],
                  _source: ['version_id'],
                  size: 1,
                },
              },
              lastModified: { max: { field: 'last_modified' } },
            },
          },
        },
      },
      other: {
        filter: {
          bool: {
            filter: [{ terms: { ext: OTHER_EXTS } }],
            must_not: [
              { terms: { key: [...README_KEYS, SUMMARIZE_KEY] } },
              { wildcard: { key: `*/${SUMMARIZE_KEY}` } },
            ],
          },
        },
        aggs: {
          keys: {
            terms: {
              field: 'key',
              size: MAX_OTHER,
              order: { 'lastModified.value': 'desc' },
            },
            aggs: {
              latestVersion: {
                top_hits: {
                  sort: [{ last_modified: { order: 'desc' } }],
                  _source: ['version_id', 'ext'],
                  size: 1,
                },
              },
              lastModified: { max: { field: 'last_modified' } },
            },
          },
        },
      },
      summarize: {
        filter: {
          term: { key: SUMMARIZE_KEY },
        },
        aggs: {
          latestVersion: {
            top_hits: {
              sort: [{ last_modified: { order: 'desc' } }],
              _source: ['version_id'],
              size: 1,
            },
          },
        },
      },
    },
    size: 0,
  }).then(
    R.applySpec({
      readmes: R.pipe(
        R.path(['aggregations', 'readmes', 'buckets']),
        R.map((b) => ({
          bucket,
          key: b.key,
          version: extractLatestVersion(b.latestVersion.hits),
        })),
        R.filter((h) => h.version !== DELETED),
        R.sort(R.ascend((h) => README_KEYS.indexOf(h.key))),
      ),
      images: R.pipe(
        R.path(['aggregations', 'images', 'keys', 'buckets']),
        R.map((b) => ({
          bucket,
          key: b.key,
          version: extractLatestVersion(b.latestVersion.hits),
        })),
        R.filter((h) => h.version !== DELETED),
      ),
      other: R.pipe(
        R.path(['aggregations', 'other', 'keys', 'buckets']),
        R.map((b) => ({
          bucket,
          key: b.key,
          version: extractLatestVersion(b.latestVersion.hits),
          lastModified: parseDate(b.lastModified),
          // eslint-disable-next-line no-underscore-dangle
          ext: b.latestVersion.hits.hits[0]._source.ext,
        })),
        R.filter((h) => h.version !== DELETED),
        R.sortWith([
          R.ascend((h) => OTHER_EXTS.indexOf(h.ext)),
          R.descend(R.prop('lastModified')),
        ]),
      ),
      summarize: ({
        aggregations: {
          summarize: {
            latestVersion: { hits },
          },
        },
      }) => {
        if (!hits.total) return null
        const version = extractLatestVersion(hits)
        if (version === DELETED) return null
        return { bucket, key: SUMMARIZE_KEY, version }
      },
    }),
  )

export const objectVersions = ({ s3req, bucket, path }) =>
  s3req({
    bucket,
    operation: 'listObjectVersions',
    params: { Bucket: bucket, Prefix: path },
  }).then(
    R.pipe(
      R.prop('Versions'),
      R.filter((v) => v.Key === path),
      R.map((v) => ({
        isLatest: v.IsLatest || false,
        lastModified: v.LastModified,
        size: v.Size,
        id: v.VersionId,
      })),
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
  }).then(
    R.pipe(
      R.path(['Metadata', 'helium']),
      R.when(Boolean, JSON.parse),
    ),
  )

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

const mapAllP = R.curry((fn, list) => Promise.all(list.map(fn)))

const mergeAllP = (...ps) => Promise.all(ps).then(R.mergeAll)

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
    // TODO: handle 1k+ revisions (check if truncated and drain til it's not)
    const revisions = await s3req({
      bucket,
      operation: 'listObjectsV2',
      params: {
        Bucket: bucket,
        Prefix: `${PACKAGES_PREFIX}${name}/`,
      },
    }).then((r) =>
      r.Contents.reduce((acc, { Key: key }) => {
        const id = getRevisionIdFromKey(key)
        if (id === 'latest') return acc
        return [{ id, key }].concat(acc)
      }, []),
    )
    return { revisions, counts: await countsP }
  },
)

const loadRevisionHash = ({ s3req, bucket, key }) =>
  s3req({ bucket, operation: 'getObject', params: { Bucket: bucket, Key: key } }).then(
    (res) => res.Body.toString('utf-8'),
  )

export const getRevisionData = async ({ s3req, endpoint, signer, bucket, key }) => {
  const hash = await loadRevisionHash({ s3req, bucket, key })
  const manifestKey = `${MANIFESTS_PREFIX}${hash}`
  const url = signer.getSignedS3URL({ bucket, key: manifestKey })
  const maxLines = MAX_PACKAGE_ENTRIES + 2 // 1 for the meta and 1 for checking overflow
  const r = await fetch(
    `${endpoint}/preview?url=${encodeURIComponent(url)}&input=txt&line_count=${maxLines}`,
  )
  const [info, ...entries] = await r
    .json()
    .then((json) => json.info.data.head.map((l) => JSON.parse(l)))
  const files = Math.min(MAX_PACKAGE_ENTRIES, entries.length)
  const bytes = entries.slice(0, MAX_PACKAGE_ENTRIES).reduce((sum, i) => sum + i.size, 0)
  const truncated = entries.length > MAX_PACKAGE_ENTRIES
  return {
    hash,
    stats: { files, bytes, truncated },
    ...info,
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
      R.ifElse(
        R.isEmpty,
        R.always([]),
        R.pipe(
          R.split('\n'),
          R.map(JSON.parse),
        ),
      ),
    ),
  )

// TODO: Preview endpoint only allows up to 512 lines right now. Increase it to 1000.
const MAX_PACKAGE_ENTRIES = 500

export const fetchPackageTree = withErrorHandling(
  async ({ s3req, sign, endpoint, bucket, name, revision }) => {
    const hashKey = getRevisionKeyFromId(name, revision)
    const hash = await loadRevisionHash({ s3req, bucket, key: hashKey })
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

const takeR = (l, r) => r

const mkMerger = (cases) => (key, l, r) => (cases[key] || takeR)(l, r)

const merger = mkMerger({
  score: R.max,
  versions: R.pipe(
    R.concat,
    R.sortBy((v) => -v.score),
  ),
})

const mergeHits = R.pipe(
  R.reduce(
    (acc, { _score: score, _source: src }) =>
      R.mergeDeepWithKey(merger, acc, {
        [src.key]: {
          path: src.key,
          score,
          versions: [
            {
              id: src.version_id,
              score,
              updated: parseDate(src.updated),
              lastModified: parseDate(src.last_modified),
              size: src.size,
              meta: src.user_meta,
            },
          ],
        },
      }),
    {},
  ),
  R.values,
  R.sortBy((h) => -h.score),
)

export const search = async ({ es, query }) => {
  try {
    const result = await es({
      query: {
        multi_match: {
          query,
          fields: ['content', 'comment', 'key_text', 'meta_text'],
          type: 'cross_fields',
        },
      },
      _source: ['key', 'version_id', 'updated', 'last_modified', 'size', 'user_meta'],
    })
    const hits = mergeHits(result.hits.hits)
    const total = Math.min(result.hits.total, result.hits.hits.length)
    return { total, hits }
  } catch (e) {
    // TODO: handle errors
    // eslint-disable-next-line no-console
    console.log('search error', e)
    throw e
  }
}

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
