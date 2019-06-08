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

export const bucketListing = ({ s3, bucket, path = '' }) =>
  s3
    .listObjectsV2({
      Bucket: bucket,
      Delimiter: '/',
      Prefix: path,
    })
    .promise()
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

export const objectVersions = ({ s3, bucket, path }) =>
  s3
    .listObjectVersions({ Bucket: bucket, Prefix: path })
    .promise()
    .then(
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

export const objectMeta = ({ s3, bucket, path, version }) =>
  s3
    .headObject({ Bucket: bucket, Key: path, VersionId: version })
    .promise()
    .then(
      R.pipe(
        R.path(['Metadata', 'helium']),
        R.when(Boolean, JSON.parse),
      ),
    )

const isValidManifest = R.both(Array.isArray, R.all(R.is(String)))

export const summarize = async ({ s3, handle }) => {
  if (!handle) return null

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

export const listPackages = async ({ s3, bucket }) =>
  s3
    .listObjectsV2({
      Bucket: bucket,
      Prefix: PACKAGES_PREFIX,
    })
    .promise()
    .then(
      R.pipe(
        R.prop('Contents'),
        R.map(({ Key, LastModified }) => {
          const i = Key.lastIndexOf('/')
          const name = Key.substring(PACKAGES_PREFIX.length, i)
          const revision = Key.substring(i + 1)
          return { name, revision, key: Key, modified: LastModified }
        }),
        R.reduce(
          (acc, { name, revision, key, modified }) => ({
            ...acc,
            [name]: { ...acc[name], [revision]: { key, modified } },
          }),
          {},
        ),
        R.toPairs,
        R.map(([name, revisions]) => ({ name, revisions })),
        R.filter(({ name }) => name.includes('/')),
      ),
    )
    .catch(catchErrors())

const loadRevisionHash = ({ s3, bucket, key }) =>
  s3
    .getObject({ Bucket: bucket, Key: key })
    .promise()
    .then((res) => res.Body.toString('utf-8'))

const parseJSONL = R.pipe(
  R.split('\n'),
  R.map(R.tryCatch(JSON.parse, () => null)),
  R.reject(R.isNil),
)

const getRevisionIdFromKey = (key) => key.substring(key.lastIndexOf('/') + 1)
const getRevisionKeyFromId = (name, id) => `${PACKAGES_PREFIX}${name}/${id}`

export const getPackageRevisions = withErrorHandling(
  async ({ s3, signer, endpoint, bucket, name }) => {
    const res = await s3
      .listObjectsV2({
        Bucket: bucket,
        Prefix: `${PACKAGES_PREFIX}${name}/`,
      })
      .promise()

    const loadRevision = async (key) => {
      const hash = await loadRevisionHash({ s3, bucket, key })
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
        const head = await s3.headObject({ Bucket: bucket, Key: manifestKey }).promise()
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

export const fetchPackageTree = withErrorHandling(
  async ({ s3, bucket, name, revision }) => {
    const hashKey = getRevisionKeyFromId(name, revision)
    const hash = await loadRevisionHash({ s3, bucket, key: hashKey })
    const manifestKey = `${MANIFESTS_PREFIX}${hash}`
    const r = await s3.getObject({ Bucket: bucket, Key: manifestKey }).promise()
    const [info, ...keys] = parseJSONL(r.Body.toString('utf-8'))
    const modified = r.LastModified
    return { id: revision, hash, info, keys, modified }
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
  s3,
  analyticsBucket,
  type,
  query,
  today,
  window = 365,
}) => {
  try {
    const { Payload } = await s3
      .selectObjectContent({
        Bucket: analyticsBucket,
        Key: `${ACCESS_COUNTS_PREFIX}/${type}.csv`,
        Expression: query,
        ExpressionType: 'SQL',
        InputSerialization: { CSV: { FileHeaderInfo: 'Use' } },
        OutputSerialization: { JSON: {} },
      })
      .promise()

    const recordedCounts = Payload.reduce((acc, i) => {
      if (!i.Records) return acc
      const [json] = i.Records.Payload.toString().split('\n')
      const data = JSON.parse(json)
      return JSON.parse(data.counts)
    }, {})

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

export const pkgAccessCounts = ({ s3, analyticsBucket, bucket, name, today }) =>
  queryAccessCounts({
    s3,
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
  s3,
  analyticsBucket,
  bucket,
  name,
  hash,
  today,
}) =>
  queryAccessCounts({
    s3,
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
