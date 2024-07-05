import * as Eff from 'effect'
import { useHistory } from 'react-router-dom'
import * as S from '@effect/schema/Schema'

import * as SearchModel from 'containers/Search/model'
import * as Model from 'model'

import * as Content from './Content'
import * as Tool from './Tool'

// TODO: more comprehensive params
const SearchParamsSchema = S.Struct({
  resultType: S.Enums(SearchModel.ResultType).annotations({
    title: 'result type',
    description: 'whether to search for objects or packages',
  }),
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
}).annotations({
  title: 'search parameters',
  description: 'Start a search session',
})

function useStartSearch() {
  const makeUrl = SearchModel.useMakeUrl()
  const history = useHistory()
  return Tool.useMakeTool(
    SearchParamsSchema,
    (params) =>
      Eff.Effect.gen(function* () {
        yield* Eff.Console.debug('tool: start search', params)

        const defaultParams = SearchModel.parseSearchParams(`t=${params.resultType}`)
        const url = makeUrl({ ...defaultParams, ...params } as SearchModel.SearchUrlState)
        yield* Eff.Effect.sync(() => history.push(url))
        return Eff.Option.some(
          Tool.Result({
            status: 'success',
            content: [
              Content.ToolResultContentBlock.Text({
                text: `navigating to the search page and starting the search session`,
              }),
            ],
          }),
        )
      }),
    [makeUrl, history],
  )
}

export function useGlobalTools(): Tool.Collection {
  return {
    catalog_global_startSearch: useStartSearch(),
  }
}

export { useGlobalTools as use }
