import * as React from 'react'
import { useHistory } from 'react-router-dom'
import * as S from '@effect/schema/Schema'

import * as SearchModel from 'containers/Search/model'
import * as Model from 'model'

import * as Context from './Context'

const SearchParamsBaseSchema = S.Struct({
  searchString: S.optional(S.String).annotations({
    title: 'search string',
    description: 'string to search for',
  }),
  buckets: S.Array(S.String).annotations({
    title: 'search buckets',
    description: 'a list of buckets to search in (keep empty to search in all buckets)',
  }),
  order: S.Enums(Model.GQLTypes.SearchResultOrder).annotations({
    title: 'search order',
    description: 'order of search results',
  }),
})

// XXX: more comprehensive params
const SearchParamsSchema = S.Struct({
  resultType: S.Enums(SearchModel.ResultType).annotations({
    title: 'result type',
    description: 'whether to search for objects or packages',
  }),
  ...SearchParamsBaseSchema.fields,
}).annotations({
  title: 'search parameters',
  description: 'Start a search session',
})

// console.log('JSON schema for search params', JSONSchema.make(SearchParamsSchema))

interface SearchParams extends S.Schema.Type<typeof SearchParamsSchema> {}

function useStartSearch() {
  const makeUrl = SearchModel.useMakeUrl()
  const history = useHistory()
  return React.useCallback(
    async (params: SearchParams) => {
      // eslint-disable-next-line no-console
      console.log('start search', params)

      const defaultParams = SearchModel.parseSearchParams(`t=${params.resultType}`)
      const url = makeUrl({ ...defaultParams, ...params } as SearchModel.SearchUrlState)
      history.push(url)
      return [{ text: 'navigating to the search page and starting the search session' }]
    },
    [makeUrl, history],
  )
}

export function useSearchTools(): Context.ToolMap {
  const startSearch = useStartSearch()
  return React.useMemo(
    () => ({
      catalog_global_startSearch: Context.makeTool(SearchParamsSchema, startSearch),
    }),
    [startSearch],
  )
}
