import * as R from 'ramda'

const parseDate = (d) => d && new Date(d)

const PACKAGES_SUFFIX = '_packages'

const DEFAULT_INDEX = '*'

/*
File: {
  key: str,
  type: 'object',
  score: num,
  bucket: str,
  path: str,
  versions: [
    {
      id: str,
      score: num,
      updated: ?Date,
      lastModified: ?Date,
      size: num,
      meta: str,
    },
  ],
}

Package: {
  key: str,
  type: 'package',
  score: num,
  bucket: str,
  handle: str,
  revisions: [
    {
      id: str,
      hash: str,
      score: num,
      lastModified: ?Date,
      meta: str, // should it be parsed?
    },
  ],
}
*/

const getTypeAndBucketFromIndex = (idx) => {
  const i = idx.lastIndexOf('-reindex-')
  const idxNormalized = i === -1 ? idx : idx.slice(0, i)
  const suffixIdx = idxNormalized.lastIndexOf(PACKAGES_SUFFIX)
  return suffixIdx === -1
    ? { type: 'object', bucket: idxNormalized }
    : { type: 'package', bucket: idxNormalized.slice(0, suffixIdx) }
}

const extractObjData = ({ bucket, score, src }) => {
  const key = `object:${bucket}/${src.key}`
  return {
    [key]: {
      key,
      type: 'object',
      score,
      bucket,
      path: src.key,
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
  }
}

const extractPkgData = ({ bucket, id, score, src }) => {
  const [handle, hash] = id.split(':')
  const key = `package:${bucket}/${handle}`
  return {
    [key]: {
      key,
      type: 'package',
      bucket,
      score,
      handle,
      revisions: [
        {
          id: src.id, // TODO: see how it will be called in the index
          hash,
          score,
          lastModified: parseDate(src.last_modified),
          meta: src.metadata, // TODO: expose this in lambda
        },
      ],
    },
  }
}

const extractData = ({ _id: id, _score: score, _source: src, _index: idx }) => {
  const { type, bucket } = getTypeAndBucketFromIndex(idx)
  const extract = type === 'object' ? extractObjData : extractPkgData
  return extract({ bucket, id, score, src })
}

const takeR = (l, r) => r

const mkMerger = (cases) => (key, l, r) => (cases[key] || takeR)(l, r)

const mergeHits = R.mergeDeepWithKey(
  mkMerger({
    score: R.max,
    versions: R.pipe(
      R.concat,
      R.sortBy((v) => -v.score),
    ),
    revisions: R.pipe(
      R.concat,
      R.sortBy((v) => -v.score),
    ),
  }),
)

const mergeAllHits = R.pipe(
  R.reduce((acc, hit) => mergeHits(acc, extractData(hit)), {}),
  R.values,
  R.sortBy((h) => -h.score),
)

export default async function search({
  es,
  query,
  buckets = [],
  mode = 'all', // all | objects | packages
}) {
  // TODO: use APIGateway request directly
  const index = R.pipe(
    R.chain((b) => {
      const idxs = []
      if (mode === 'objects' || mode === 'all') {
        idxs.push(b)
      }
      if (mode === 'packages' || mode === 'all') {
        idxs.push(`${b}_packages`)
      }
      return idxs
    }),
    R.join(','),
    (i) => i || DEFAULT_INDEX,
  )(buckets)
  try {
    const result = await es({ action: 'search', index, query })
    const hits = mergeAllHits(result.hits.hits)
    const total = Math.min(result.hits.total, result.hits.hits.length)
    // TODO: calc number of objects + versions and packages + revisions separately
    return { total, hits }
  } catch (e) {
    // TODO: handle errors
    // eslint-disable-next-line no-console
    console.log('search error', e)
    throw e
  }
}
