import * as React from 'react'

import * as Model from 'model'
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

interface ResultsErrorPage {
  _tag: 'page'
  error:
    | Extract<SearchUIModel.SearchUIModel['firstPageQuery'], { _tag: 'error' }>['error']
    | Extract<
        ReturnType<typeof SearchUIModel.useNextPagePackagesQuery>,
        { _tag: 'error' }
      >['error']
}

interface ResultsErrorData {
  _tag: 'data'
  error: Model.GQLTypes.InputError
}

interface ResultsErrorGeneral {
  _tag: 'general'
  error: Error
}

interface ResultsFail {
  _tag: 'fail'
  error: ResultsErrorPage | ResultsErrorData | ResultsErrorGeneral
}

type ResultsNotFulfilled = ResultsInProgress | ResultsFail | ResultsEmpty | ResultsIdle

interface ResultsOk {
  _tag: 'ok'
  cursor: string | null
  hits: readonly (Hit | null)[]
  determinate: boolean
  next?: ResultsNotFulfilled
}

export type Results = ResultsOk | ResultsNotFulfilled

type NextResults =
  | Omit<ResultsOk, 'determinate'>
  | Exclude<ResultsNotFulfilled, ResultsEmpty | ResultsIdle>

function parseNextResults(
  query: ReturnType<typeof SearchUIModel.useNextPagePackagesQuery>,
): NextResults {
  switch (query._tag) {
    case 'fetching':
      return IN_PROGRESS
    case 'error':
      return { _tag: 'fail' as const, error: { _tag: 'page', error: query.error } }
    case 'data':
      switch (query.data.__typename) {
        case 'InvalidInput':
          const [error] = query.data.errors
          return { _tag: 'fail' as const, error: { _tag: 'data', error } }
        case 'PackagesSearchResultSetPage':
          const { hits, ...data } = query.data
          return {
            _tag: 'ok' as const,
            hits: hits.length ? hits.map(parseHit) : [null],
            ...data,
          }
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
      return { _tag: 'fail' as const, error: { _tag: 'page', error: query.error } }
    case 'data':
      switch (query.data.__typename) {
        case 'EmptySearchResultSet':
          return EMPTY
        case 'InvalidInput':
          const [error] = query.data.errors
          return { _tag: 'fail' as const, error: { _tag: 'data', error } }
        case 'PackagesSearchResultSet':
          const { hits, ...data } = query.data.firstPage
          return {
            _tag: 'ok' as const,
            hits: hits.length ? hits.map(parseHit) : [null],
            determinate: query.data.total > -1, // `-1` == secure search
            ...data,
          }
        case 'ObjectsSearchResultSet':
          return {
            _tag: 'fail' as const,
            error: {
              _tag: 'general',
              error: new Error(
                'Not implemented and should not happen in this implementation',
              ),
            },
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

type NextPage =
  | Omit<ResultsOk, 'determinate'>
  | Exclude<ResultsNotFulfilled, ResultsEmpty>

function useNextPage(acc: Results, loadMore: boolean): NextPage {
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
        setResults((prev) => {
          if (prev._tag !== 'ok') {
            return {
              _tag: 'fail',
              error: {
                _tag: 'general',
                error: new Error(
                  'We can only append next page to the previous "Ok" page',
                ),
              },
            }
          }
          return {
            ...prev,
            next,
          }
        })
        break
      case 'ok':
        setMore(false)
        setResults((prev) => {
          if (prev._tag !== 'ok') return prev
          return {
            _tag: prev._tag,
            hits: prev.hits.concat(next.hits),
            determinate: prev.determinate,
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
