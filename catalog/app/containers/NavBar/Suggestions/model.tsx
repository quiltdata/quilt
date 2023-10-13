import * as React from 'react'

import * as SearchUIModel from 'containers/Search/model'

export type Item =
  | {
      key: string
      title: React.ReactNode
      url: string
    }
  | string

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

const global = (searchString: string, makeUrl: ReturnType<typeof useMakeUrl>): Item[] => [
  {
    key: 'global-packages',
    title: searchString ? (
      <>
        Search <b>"{searchString}"</b> in <b>packages</b> in <b>all buckets</b>
      </>
    ) : (
      <>
        Search <b>all packages</b> in <b>all buckets</b>
      </>
    ),
    url: makeUrl({
      searchString,
      resultType: SearchUIModel.ResultType.QuiltPackage,
    }),
  },
  {
    key: 'global-objects',
    title: searchString ? (
      <>
        Search <b>"{searchString}"</b> in <b>objects</b> in <b>all buckets</b>
      </>
    ) : (
      <>
        Search <b>all object</b> in <b>all buckets</b>
      </>
    ),
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
): Item[] => [
  {
    key: 'bucket-packages',
    title: searchString ? (
      <>
        Search <b>"{searchString}"</b> in <b>packages</b> in <b>s3://{bucket}</b>
      </>
    ) : (
      <>
        Search <b>all packages</b> in <b>s3://{bucket}</b>
      </>
    ),
    url: makeUrl({
      searchString,
      buckets: [bucket],
      resultType: SearchUIModel.ResultType.QuiltPackage,
    }),
  },
  {
    key: 'bucket-objects',
    title: searchString ? (
      <>
        Search <b>"{searchString}"</b> in <b>objects</b> in <b>s3://{bucket}</b>
      </>
    ) : (
      <>
        Search <b>all objects</b> in <b>s3://{bucket}</b>
      </>
    ),
    url: makeUrl({
      searchString,
      buckets: [bucket],
      resultType: SearchUIModel.ResultType.S3Object,
    }),
  },
  ...global(searchString, makeUrl),
]

function getEmptyFilter(resultType: SearchUIModel.ResultType) {
  const empty = new URLSearchParams()
  return resultType === SearchUIModel.ResultType.S3Object
    ? SearchUIModel.ObjectsSearchFilterIO.fromURLSearchParams(empty)
    : SearchUIModel.PackagesSearchFilterIO.fromURLSearchParams(empty)
}

const inSearch = (
  searchString: string,
  makeUrl: ReturnType<typeof useMakeUrl>,
  model: SearchUIModel.SearchUIModel,
): Item[] => [
  searchString
    ? {
        key: 'preserve-filters',
        title: (
          <>
            Search <b>"{searchString}"</b> with current settings
          </>
        ),
        url: makeUrl({ ...model.state, searchString }),
      }
    : makeUrl({ ...model.state, searchString }),
  {
    key: 'reset-filters',
    title: searchString ? (
      <>
        Reset filters and search <b>"{searchString}"</b>
      </>
    ) : (
      <>Reset filters</>
    ),
    url: makeUrl({
      ...model.state,
      searchString,
      filter: getEmptyFilter(model.state.resultType),
    } as SearchUIModel.SearchUrlState),
  },
]

function useItems(
  searchString: string,
  context: null | string | SearchUIModel.SearchUIModel,
) {
  const makeUrl = useMakeUrl()
  return React.useMemo(() => {
    if (!context) return global(searchString, makeUrl)
    if (typeof context === 'string') return inBucket(searchString, makeUrl, context)
    return inSearch(searchString, makeUrl, context)
  }, [context, makeUrl, searchString])
}

function useSuggestions(
  searchString: string,
  context: null | string | SearchUIModel.SearchUIModel,
) {
  const [selected, setSelected] = React.useState(0)
  const items = useItems(searchString, context)
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
