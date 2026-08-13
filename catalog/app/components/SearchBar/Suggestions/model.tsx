import * as React from 'react'

import * as SearchUIModel from 'containers/Search/model'

import { classifyQuery } from '../classify'

const { QuiltPackage, S3Object } = SearchUIModel.ResultType

// A destination the bar can commit to. Search suggestions are links; the Qurator
// suggestion is an action (the assistant is not a route). Enter always commits
// the *selected* item -- the list is the single source of truth about where the
// query is going, so what the user sees highlighted is what happens.
export interface SearchSuggestion {
  kind: 'search'
  key: string
  what: React.ReactNode
  where: React.ReactNode
  url: string
}

export interface QuratorSuggestion {
  kind: 'qurator'
  key: string
  query: string
}

export type Suggestion = SearchSuggestion | QuratorSuggestion

function useMakeUrl() {
  const makeUrl = SearchUIModel.useMakeUrl()
  return React.useCallback(
    (params: Partial<SearchUIModel.SearchUrlState>) => {
      const defaultParams = SearchUIModel.parseSearchParams('')
      return makeUrl({
        ...defaultParams,
        ...params,
      } as SearchUIModel.SearchUrlState)
    },
    [makeUrl],
  )
}

function what(searchString: string, resultType: SearchUIModel.ResultType) {
  const typeDisplay =
    resultType === SearchUIModel.ResultType.QuiltPackage ? 'packages' : 'objects'
  return searchString ? (
    <>
      &laquo;<b>{searchString}</b>&raquo; in <b>{typeDisplay}</b>
    </>
  ) : (
    <b>all {typeDisplay}</b>
  )
}

const inAllBuckets = (
  <>
    in <b>all buckets</b>
  </>
)
const inSelectedBuckets = (buckets: readonly string[]) => {
  const bucketsDisplay =
    buckets.length === 1 ? <code>{`s3://${buckets[0]}`}</code> : 'selected buckets'
  return (
    <>
      in <b>{bucketsDisplay}</b>
    </>
  )
}

const global = (
  searchString: string,
  makeUrl: ReturnType<typeof useMakeUrl>,
): SearchSuggestion[] => [
  {
    kind: 'search',
    key: 'global-packages',
    what: what(searchString, QuiltPackage),
    where: inAllBuckets,
    url: makeUrl({
      searchString,
      resultType: SearchUIModel.ResultType.QuiltPackage,
    }),
  },
  {
    kind: 'search',
    key: 'global-objects',
    what: what(searchString, S3Object),
    where: inAllBuckets,
    url: makeUrl({
      searchString,
      resultType: SearchUIModel.ResultType.S3Object,
    }),
  },
]

const inBucket = (
  searchString: string,
  makeUrl: ReturnType<typeof useMakeUrl>,
  bucket: string,
): SearchSuggestion[] => [
  {
    kind: 'search',
    key: 'bucket-packages',
    what: what(searchString, QuiltPackage),
    where: inSelectedBuckets([bucket]),
    url: makeUrl({
      searchString,
      buckets: [bucket],
      resultType: SearchUIModel.ResultType.QuiltPackage,
    }),
  },
  {
    kind: 'search',
    key: 'bucket-objects',
    what: what(searchString, S3Object),
    where: inSelectedBuckets([bucket]),
    url: makeUrl({
      searchString,
      buckets: [bucket],
      resultType: SearchUIModel.ResultType.S3Object,
    }),
  },
  ...global(searchString, makeUrl),
]

const inSearch = (
  searchString: string,
  makeUrl: ReturnType<typeof useMakeUrl>,
  model: SearchUIModel.SearchUIModel,
): SearchSuggestion[] => {
  const otherType = model.state.resultType === QuiltPackage ? S3Object : QuiltPackage
  const items: SearchSuggestion[] = [
    {
      kind: 'search',
      key: 'current-settings',
      what: what(searchString, model.state.resultType),
      where: (
        <>
          with <b>current settings</b>
        </>
      ),
      url: makeUrl({ ...model.state, searchString }),
    },
  ]
  if (model.state.buckets.length)
    items.push({
      kind: 'search',
      key: 'same-type-selected-buckets',
      what: what(searchString, model.state.resultType),
      where: inSelectedBuckets(model.state.buckets),
      url: makeUrl({
        searchString,
        resultType: model.state.resultType,
        buckets: model.state.buckets,
      }),
    })
  items.push({
    kind: 'search',
    key: 'same-type-all-buckets',
    what: what(searchString, model.state.resultType),
    where: inAllBuckets,
    url: makeUrl({ searchString, resultType: model.state.resultType }),
  })
  if (model.state.buckets.length)
    items.push({
      kind: 'search',
      key: 'other-type-selected-buckets',
      what: what(searchString, otherType),
      where: inSelectedBuckets(model.state.buckets),
      url: makeUrl({
        searchString,
        resultType: otherType,
        buckets: model.state.buckets,
      }),
    })
  items.push({
    kind: 'search',
    key: 'other-type-all-buckets',
    what: what(searchString, otherType),
    where: inAllBuckets,
    url: makeUrl({ searchString, resultType: otherType }),
  })
  return items
}

function useItems(
  searchString: string,
  context: null | string | SearchUIModel.SearchUIModel,
  quratorEnabled: boolean,
): Suggestion[] {
  const makeUrl = useMakeUrl()
  return React.useMemo(() => {
    const searchItems = (() => {
      if (!context) return global(searchString, makeUrl)
      if (typeof context === 'string') return inBucket(searchString, makeUrl, context)
      return inSearch(searchString, makeUrl, context)
    })()
    // A natural-language query leads with the assistant, because that is where
    // Enter goes. Putting it first (rather than routing around a search row that
    // says "Search ...") is what keeps the highlighted row honest; the search
    // destinations stay below it, one arrow-press away.
    if (classifyQuery(searchString, quratorEnabled) !== 'Qurator') return searchItems
    return [
      { kind: 'qurator', key: 'qurator', query: searchString.trim() } as const,
      ...searchItems,
    ]
  }, [context, makeUrl, quratorEnabled, searchString])
}

function useSuggestions(
  searchString: string,
  context: null | string | SearchUIModel.SearchUIModel,
  quratorEnabled = false,
) {
  const [rawSelected, setSelected] = React.useState(0)
  const items = useItems(searchString, context, quratorEnabled)
  // Typing changes the list's length (the Qurator row appears and disappears);
  // clamp so the highlight -- and therefore Enter -- always lands on a real row.
  const selected = Math.min(Math.max(rawSelected, 0), items.length - 1)
  const cycleSelected = React.useCallback(
    (reverse: boolean) => {
      setSelected((s) => {
        if (!Array.isArray(items)) return 0
        const max = items.length - 1
        if (reverse) {
          if (s <= 0) return max
          return s - 1
        } else {
          if (s < 0) return 0
          if (s >= max) return 0
          return s + 1
        }
      })
    },
    [items],
  )
  const item = items[selected] as Suggestion | undefined
  return React.useMemo(
    () => ({ cycleSelected, item, items, selected, setSelected }),
    [cycleSelected, item, items, selected, setSelected],
  )
}

export { useSuggestions as use }
