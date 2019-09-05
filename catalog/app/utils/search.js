import * as R from 'ramda'

const takeR = (l, r) => r

const mkMerger = (cases) => (key, l, r) => (cases[key] || takeR)(l, r)

const merger = mkMerger({
  score: R.max,
  versions: R.pipe(
    R.concat,
    R.sortBy((v) => -v.score),
  ),
})

const parseDate = (d) => d && new Date(d)

// TODO: expose bucket (use index name?)
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

export default async function search({ es, query, buckets }) {
  try {
    const result = await es({
      index: buckets ? buckets.join(',') : '_all',
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
