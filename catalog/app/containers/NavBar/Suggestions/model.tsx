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
const inSelectedBuckets = (buckets: string[]) => {
  const bucketsDisplay = buckets.length === 1 ? `s3://${buckets[0]}` : 'selected buckets'
  return (
    <>
      in <b>{bucketsDisplay}</b>
    </>
  )
}

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

const inBucket = (
  searchString: string,
  makeUrl: ReturnType<typeof useMakeUrl>,
  bucket: string,
): Suggestion[] => [
  {
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
): Suggestion[] => {
  const otherType = model.state.resultType === QuiltPackage ? S3Object : QuiltPackage
  const items = [
    {
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
    key: 'same-type-all-buckets',
    what: what(searchString, model.state.resultType),
    where: inAllBuckets,
    url: makeUrl({ searchString, resultType: model.state.resultType }),
  })
  if (model.state.buckets.length)
    items.push({
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
