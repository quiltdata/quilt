import * as React from 'react'

import * as SearchUIModel from 'containers/Search/model'

const { QuiltPackage, S3Object } = SearchUIModel.ResultType

export interface Suggestion {
  key: string
  what: React.ReactNode
  where: React.ReactNode
  url: string
}

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

const global = (
  searchString: string,
  makeUrl: ReturnType<typeof useMakeUrl>,
): Suggestion[] => [
  {
    key: 'global-packages',
    what: what(searchString, QuiltPackage),
    where: inAllBuckets,
    url: makeUrl({
      searchString,
      resultType: SearchUIModel.ResultType.QuiltPackage,
    }),
  },
  {
    key: 'global-objects',
    what: what(searchString, S3Object),
    where: inAllBuckets,
    url: makeUrl({
      searchString,
      resultType: SearchUIModel.ResultType.S3Object,
    }),
  },
]

function useItems(searchString: string) {
  const makeUrl = useMakeUrl()
  return React.useMemo(() => global(searchString, makeUrl), [makeUrl, searchString])
}

function useSuggestions(searchString: string) {
  const [selected, setSelected] = React.useState(0)
  const items = useItems(searchString)
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
  const url = React.useMemo(() => {
    const selectedItem = items[selected]
    return typeof selectedItem === 'string' ? selectedItem : selectedItem.url
  }, [items, selected])
  return React.useMemo(
    () => ({ cycleSelected, items, selected, setSelected, url }),
    [cycleSelected, items, selected, setSelected, url],
  )
}

export { useSuggestions as use }
