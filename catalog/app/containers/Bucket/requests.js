import * as dateFns from 'date-fns'
import * as R from 'ramda'

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

export const listPackages = ({ s3req, bucket }) =>
  s3req({
    bucket,
    operation: 'listObjectsV2',
    params: {
      Bucket: bucket,
      Prefix: PACKAGES_PREFIX,
      Delimiter: '/',
    },
  })
    .then(({ CommonPrefixes: ownerPrefixes }) =>
      Promise.all(
        ownerPrefixes.map(({ Prefix }) =>
          s3req({
            bucket,
            operation: 'listObjectsV2',
            params: {
              Bucket: bucket,
              Prefix,
              Delimiter: '/',
            },
          }).then(({ CommonPrefixes: namePrefixes }) =>
            Promise.all(
              namePrefixes.map((p) =>
                s3req({
                  bucket,
                  operation: 'listObjectsV2',
                  params: {
                    Bucket: bucket,
                    Prefix: `${p.Prefix}latest`,
                  },
                }).then(({ Contents: [latest] }) => {
                  const name = p.Prefix.slice(PACKAGES_PREFIX.length, -1)
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
                }),
              ),
            ),
          ),
        ),
      ),
    )
    .then(R.unnest)
    .catch(catchErrors())

const loadRevisionHash = ({ s3req, bucket, key }) =>
  s3req({ bucket, operation: 'getObject', params: { Bucket: bucket, Key: key } }).then(
    (res) => res.Body.toString('utf-8'),
  )

const getRevisionIdFromKey = (key) => key.substring(key.lastIndexOf('/') + 1)
const getRevisionKeyFromId = (name, id) => `${PACKAGES_PREFIX}${name}/${id}`

export const getPackageRevisions = withErrorHandling(
  async ({ s3req, signer, endpoint, bucket, name }) => {
    const res = await s3req({
      bucket,
      operation: 'listObjectsV2',
      params: {
        Bucket: bucket,
        Prefix: `${PACKAGES_PREFIX}${name}/`,
      },
    })

    const loadRevision = async (key) => {
      const hash = await loadRevisionHash({ s3req, bucket, key })
      const manifestKey = `${MANIFESTS_PREFIX}${hash}`

      const loadInfo = async () => {
        const url = signer.getSignedS3URL({ bucket, key: manifestKey })
        const r = await fetch(
          `${endpoint}/preview?url=${encodeURIComponent(url)}&input=txt&line_count=1`,
        )
        const json = await r.json()
        try {
          return JSON.parse(json.info.data.head[0])
        } catch (e) {
          return {}
        }
      }

      const loadModified = async () => {
        const head = await s3req({
          bucket,
          operation: 'headObject',
          params: { Bucket: bucket, Key: manifestKey },
        })
        return head.LastModified
      }

      return {
        id: getRevisionIdFromKey(key),
        hash,
        info: await loadInfo(),
        modified: await loadModified(),
      }
    }

    const revisions = await Promise.all(res.Contents.map((i) => loadRevision(i.Key)))
    const sorted = R.sortBy((r) => -r.modified, revisions)
    return sorted
  },
)

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
      R.split('\n'),
      R.map(JSON.parse),
    ),
  )

export const fetchPackageTree = withErrorHandling(
  async ({ s3req, bucket, name, revision }) => {
    const hashKey = getRevisionKeyFromId(name, revision)
    const hash = await loadRevisionHash({ s3req, bucket, key: hashKey })
    const manifestKey = `${MANIFESTS_PREFIX}${hash}`

    const [[{ total }], keys] = await Promise.all([
      s3Select({
        s3req,
        Bucket: bucket,
        Key: manifestKey,
        Expression: `
          SELECT COUNT(*) AS total
          FROM S3Object[*] o
          WHERE o.logical_key IS NOT MISSING
        `,
      }),
      s3Select({
        s3req,
        Bucket: bucket,
        Key: manifestKey,
        Expression: `
          SELECT
            o.logical_key AS logicalKey,
            o.physical_keys[0] AS physicalKey,
            o."size" AS "size"
          FROM S3Object[*] o
          WHERE o.logical_key IS NOT MISSING
          LIMIT 1000
        `,
      }),
    ])

    const truncated = total > keys.length

    return { id: revision, hash, keys, truncated }
  },
)

const SEARCH_SIZE = 1000
const SEARCH_REQUEST_TIMEOUT = 120000
const SEARCH_FIELDS = ['key', 'size', 'type', 'updated', 'user_meta', 'version_id']

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
              updated: new Date(src.updated),
              size: src.size,
              type: src.type,
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
    const result = await es.search({
      _source: SEARCH_FIELDS,
      index: 'drive',
      type: '_doc',
      requestTimeout: SEARCH_REQUEST_TIMEOUT,
      body: {
        query: {
          query_string: {
            default_field: 'content',
            query,
          },
        },
        size: SEARCH_SIZE,
      },
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
    const [{ counts: recordedCountsJson }] = await s3Select({
      s3req,
      Bucket: analyticsBucket,
      Key: `${ACCESS_COUNTS_PREFIX}/${type}.csv`,
      Expression: query,
      InputSerialization: { CSV: { FileHeaderInfo: 'Use' } },
    })

    const recordedCounts = JSON.parse(recordedCountsJson)

    const counts = R.times((i) => {
      const date = dateFns.subDays(today, window - i - 1)
      return {
        date,
        value: recordedCounts[dateFns.format(date, 'YYYY-MM-DD')] || 0,
      }
    }, window)

    const total = counts.reduce((sum, { value }) => sum + value, 0)

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

export const pkgAccessCounts = ({ s3req, analyticsBucket, bucket, name, today }) =>
  queryAccessCounts({
    s3req,
    analyticsBucket,
    type: 'Packages',
    query: `
      SELECT counts FROM s3object
      WHERE eventname = 'GetObject'
      AND bucket = '${sqlEscape(bucket)}'
      AND name = '${sqlEscape(name)}'
    `,
    today,
    window: 30,
  })

export const pkgVersionAccessCounts = ({
  s3req,
  analyticsBucket,
  bucket,
  name,
  hash,
  today,
}) =>
  queryAccessCounts({
    s3req,
    analyticsBucket,
    type: 'PackageVersions',
    query: `
      SELECT counts FROM s3object
      WHERE eventname = 'GetObject'
      AND bucket = '${sqlEscape(bucket)}'
      AND name = '${sqlEscape(name)}'
      AND hash = '${sqlEscape(hash)}'
    `,
    today,
    window: 30,
  })
