// XXX: remove once embed is converted to use GQL search
import * as R from 'ramda'
import * as React from 'react'

import * as APIConnector from 'utils/APIConnector'
import * as BucketConfig from 'utils/BucketConfig'
import { BaseError } from 'utils/error'
import mkSearch from 'utils/mkSearch'

export class SearchError extends BaseError {}

const parseDate = (d) => d && new Date(d)

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
*/

const getBucketFromIndex = (idx) => {
  const i = idx.lastIndexOf('-reindex-')
  return i === -1 ? idx : idx.slice(0, i)
}

const extractData = ({ _score: score, _source: src, _index: idx }) => {
  const bucket = getBucketFromIndex(idx)
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
          deleteMarker: src.delete_marker,
        },
      ],
    },
  }
}

const takeR = (_l, r) => r

const mkMerger = (cases) => (key, l, r) => (cases[key] || takeR)(l, r)

const mergeHits = R.mergeDeepWithKey(
  mkMerger({
    score: R.max,
    versions: R.pipe(
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

const unescape = (s) => s.replace(/\\n/g, '\n')

export default function useSearch() {
  const req = APIConnector.use()
  const bucketConfigs = BucketConfig.useRelevantBucketConfigs()
  const allBuckets = React.useMemo(
    () => bucketConfigs.map((b) => b.name),
    [bucketConfigs],
  )

  return React.useCallback(
    async ({ query, buckets = [], retry }) => {
      const index = (buckets.length ? buckets : allBuckets).join(',')
      try {
        const qs = mkSearch({ index, action: 'search', query, retry })
        const result = await req(`/search${qs}`)
        const hits = mergeAllHits(result.hits.hits)
        return { hits, total: result.hits.total }
      } catch (e) {
        if (e instanceof APIConnector.HTTPError) {
          const match = e.text.match(/^RequestError\((\d+), '(\w+)', '(.+)'\)$/)
          if (match) {
            const code = match[2]
            const details = unescape(match[3])

            if (code === 'search_phase_execution_exception') {
              throw new SearchError('SearchSyntaxError', { details })
            }

            throw new SearchError('RequestError', {
              code,
              details,
              status: parseInt(match[1], 10) || undefined,
            })
          }
          if (e.text && /^ConnectionTimeout/.test(e.text)) {
            throw new SearchError('Timeout')
          }
        }
        // eslint-disable-next-line no-console
        console.log('Search error:')
        // eslint-disable-next-line no-console
        console.error(e)
        throw new SearchError('Unexpected', { originalError: e })
      }
    },
    [req, allBuckets],
  )
}
