import * as R from 'ramda'
import * as React from 'react'

import * as APIConnector from 'utils/APIConnector'
import { BaseError } from 'utils/error'
import mkSearch from 'utils/mkSearch'

export class SearchError extends BaseError {}

const parseDate = (d) => d && new Date(d)

const PACKAGES_SUFFIX = '_packages'

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
  hash: str,
  lastModified: ?Date,
  meta: str, // should it be parsed?
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
          deleteMarker: src.delete_marker,
        },
      ],
    },
  }
}

const parseJSON = (s) => {
  try {
    return JSON.parse(s)
  } catch (e) {
    return s
  }
}

const extractPkgData = ({ bucket, score, src }) => {
  if (src.delete_marker || !src.hash) return {}
  const key = `package:${bucket}/${src.handle}:${src.hash}`
  return {
    [key]: {
      key,
      type: 'package',
      bucket,
      score,
      handle: src.handle,
      hash: src.hash,
      lastModified: parseDate(src.last_modified),
      meta: parseJSON(src.metadata),
      // tags: src.tags, // TODO: currently not provided
      comment: src.comment,
    },
  }
}

const extractData = ({ _score: score, _source: src, _index: idx }) => {
  const { type, bucket } = getTypeAndBucketFromIndex(idx)
  const extract = type === 'object' ? extractObjData : extractPkgData
  return extract({ bucket, score, src })
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

  return React.useCallback(
    async ({
      query,
      buckets = [],
      mode = 'all', // all | objects | packages
      retry,
    }) => {
      // eslint-disable-next-line no-nested-ternary
      const index = buckets.length
        ? R.pipe(
            R.chain((b) => {
              const idxs = []
              if (mode === 'objects' || mode === 'all') {
                idxs.push(b)
              }
              if (mode === 'packages' || mode === 'all') {
                idxs.push(`${b}${PACKAGES_SUFFIX}*`)
              }
              return idxs
            }),
            R.join(','),
          )(buckets)
        : mode === 'objects' // eslint-disable-line no-nested-ternary
        ? `*,-*${PACKAGES_SUFFIX}`
        : mode === 'packages'
        ? `*${PACKAGES_SUFFIX}`
        : '*'
      try {
        const qs = mkSearch({ index, action: 'search', query, retry })
        const result = await req(`/search${qs}`)
        const hits = mergeAllHits(result.hits.hits)
        return { hits, total: result.hits.total }
      } catch (e) {
        if (e instanceof APIConnector.HTTPError) {
          // TODO: check error types are correct
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
          // TODO: this wont work probably, bc eror doesnt get wrapped into API Gateway Error
          if (/^API Gateway error.*ConnectionTimeout/.test(e.message)) {
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
    [req],
  )
}
