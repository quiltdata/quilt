import * as React from 'react'

import assertNever from 'utils/assertNever'
import type { Json, JsonRecord } from 'utils/types'

import * as SearchUIModel from '../model'

const isJsonRecord = (obj: Json): obj is JsonRecord =>
  obj != null && typeof obj === 'object' && !Array.isArray(obj)

export interface Hit extends Omit<SearchUIModel.SearchHitPackage, 'meta'> {
  meta: JsonRecord | null | Error
}

function parseMeta(meta: SearchUIModel.SearchHitPackage['meta']): Hit['meta'] {
  try {
    if (!meta) return null
    const json = JSON.parse(meta)
    return isJsonRecord(json) ? json : new Error('Meta must be object')
  } catch (err) {
    return err instanceof Error ? err : new Error(`${err}`)
  }
}

function parseHit({ meta, ...rest }: SearchUIModel.SearchHitPackage): Hit {
  return { meta: parseMeta(meta), ...rest }
}

interface ResultsIdle {
  _tag: 'idle'
}

const IDLE: ResultsIdle = { _tag: 'idle' }

interface ResultsInProgress {
  _tag: 'in-progress'
}

const IN_PROGRESS: ResultsInProgress = { _tag: 'in-progress' }

interface ResultsEmpty {
  _tag: 'empty'
}

const EMPTY: ResultsEmpty = { _tag: 'empty' }

interface ResultsFail {
  _tag: 'fail'
  error: Error
}

type ResultsNotFullilled = ResultsInProgress | ResultsFail | ResultsEmpty | ResultsIdle

interface ResultsOk {
  _tag: 'ok'
  cursor: string | null
  hits: readonly Hit[]
  next?: ResultsNotFullilled
}

export type Results = ResultsOk | ResultsNotFullilled

function parseNextResults(
  query: ReturnType<typeof SearchUIModel.useNextPagePackagesQuery>,
): Exclude<Results, ResultsEmpty | ResultsIdle> {
  switch (query._tag) {
    case 'fetching':
      return IN_PROGRESS
    case 'error':
      return { _tag: 'fail' as const, error: query.error }
    case 'data':
      switch (query.data.__typename) {
        case 'InvalidInput':
          const [error] = query.data.errors
          return { _tag: 'fail' as const, error }
        // case 'ObjectsSearchResultSetPage':
        case 'PackagesSearchResultSetPage':
          const { hits, ...data } = query.data
          return { _tag: 'ok' as const, hits: hits.map(parseHit), ...data }
        default:
          assertNever(query.data)
      }
  }
}

function parseFirstResults(
  query: SearchUIModel.SearchUIModel['firstPageQuery'],
): Results {
  switch (query._tag) {
    case 'fetching':
      return IN_PROGRESS
    case 'error':
      return { _tag: 'fail' as const, error: query.error }
    case 'data':
      switch (query.data.__typename) {
        case 'EmptySearchResultSet':
          return EMPTY
        case 'InvalidInput':
          const [error] = query.data.errors
          return { _tag: 'fail' as const, error }
        case 'PackagesSearchResultSet':
          const { hits, ...data } = query.data.firstPage
          return { _tag: 'ok' as const, hits: hits.map(parseHit), ...data }
        case 'ObjectsSearchResultSet':
          return {
            _tag: 'fail' as const,
            error: new Error(
              'Not implemented and should not happen in this implementation',
            ),
          }
        default:
          assertNever(query.data)
      }
  }
}

function useFirstPage() {
  const model = SearchUIModel.use(SearchUIModel.ResultType.QuiltPackage)
  return React.useMemo(
    () => parseFirstResults(model.firstPageQuery),
    [model.firstPageQuery],
  )
}

function useNextPage(acc: Results, loadMore: boolean): Exclude<Results, ResultsEmpty> {
  const after = (acc._tag === 'ok' && acc.cursor) || ''
  const pause = !loadMore || !after
  const nextPage = SearchUIModel.useNextPagePackagesQuery(after, pause)
  return React.useMemo(
    () => (pause ? IDLE : parseNextResults(nextPage)),
    [pause, nextPage],
  )
}

export function useResults(): [Results, () => void] | [Results] {
  const [results, setResults] = React.useState<Results>(IDLE)
  const [more, setMore] = React.useState<boolean>(false)

  const first = useFirstPage()
  const next = useNextPage(results, more)

  React.useEffect(() => setResults(first), [first])

  React.useEffect(() => {
    switch (next._tag) {
      case 'idle':
        break
      case 'in-progress':
      case 'fail':
        setResults((prev) => ({
          ...prev,
          next,
        }))
        break
      case 'ok':
        setMore(false)
        setResults((prev) => {
          if (prev._tag !== 'ok') return prev
          return {
            _tag: 'ok',
            hits: prev.hits.concat(next.hits),
            cursor: next.cursor,
          }
        })
        break
      default:
        assertNever(next)
    }
  }, [next])

  return React.useMemo(
    () =>
      results._tag === 'ok' && !!results.cursor
        ? [results, () => setMore(true)]
        : [results],
    [results],
  )
}
