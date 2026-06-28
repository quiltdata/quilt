// XXX: remove once embed is converted to use GQL search
import * as R from 'ramda'
import * as React from 'react'

import * as APIConnector from 'utils/APIConnector'
import { useRelevantBuckets } from 'utils/Buckets'
import { BaseError } from 'utils/error'
import mkSearch from 'utils/mkSearch'

export class SearchError extends BaseError {}

const parseDate = (d: string | null | undefined): Date | undefined =>
  d ? new Date(d) : undefined

interface FileVersion {
  id: string
  score: number
  updated?: Date
  lastModified?: Date
  size: number
  meta: string
  deleteMarker?: boolean
}

export interface File {
  key: string
  type: 'object'
  score: number
  bucket: string
  path: string
  versions: FileVersion[]
}

// Raw ElasticSearch hit as returned by the /search endpoint.
interface Hit {
  _score: number
  _index: string
  _source: {
    key: string
    version_id: string
    updated?: string
    last_modified?: string
    size: number
    user_meta: string
    delete_marker?: boolean
  }
}

const getBucketFromIndex = (idx: string): string => {
  const i = idx.lastIndexOf('-reindex-')
  return i === -1 ? idx : idx.slice(0, i)
}

const extractData = ({
  _score: score,
  _source: src,
  _index: idx,
}: Hit): Record<string, File> => {
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

const takeR = <T>(_l: T, r: T): T => r

type MergeCase = (l: any, r: any) => any

const mkMerger =
  (cases: Record<string, MergeCase>) =>
  (key: string, l: unknown, r: unknown): unknown =>
    (cases[key] || takeR)(l, r)

const mergeHits = R.mergeDeepWithKey(
  mkMerger({
    score: R.max,
    versions: R.pipe(
      R.concat as (a: FileVersion[], b: FileVersion[]) => FileVersion[],
      R.sortBy((v: FileVersion) => -v.score),
    ),
  }),
) as (a: Record<string, File>, b: Record<string, File>) => Record<string, File>

const mergeAllHits: (hits: Hit[]) => File[] = R.pipe(
  R.reduce(
    (acc: Record<string, File>, hit: Hit) => mergeHits(acc, extractData(hit)),
    {} as Record<string, File>,
  ),
  R.values,
  R.sortBy((h: File) => -h.score),
)

const unescape = (s: string): string => s.replace(/\\n/g, '\n')

interface SearchParams {
  query: string
  buckets?: string[]
  retry?: number
}

export interface SearchResult {
  hits: File[]
  total: number
}

export default function useSearch() {
  const req = APIConnector.use()
  const bucketList = useRelevantBuckets()
  const allBuckets = React.useMemo(() => bucketList.map((b) => b.name), [bucketList])

  return React.useCallback(
    async ({ query, buckets = [], retry }: SearchParams): Promise<SearchResult> => {
      const index = (buckets.length ? buckets : allBuckets).join(',')
      try {
        const qs = mkSearch({ index, action: 'search', query, retry })
        const result = await req(`/search${qs}`)
        const hits = mergeAllHits(result.hits.hits)
        return { hits, total: result.hits.total }
      } catch (e) {
        if (e instanceof APIConnector.HTTPError) {
          const match = e.text?.match(/^RequestError\((\d+), '(\w+)', '(.+)'\)$/)
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
