import * as Eff from 'effect'
import { useHistory } from 'react-router-dom'
import * as S from '@effect/schema/Schema'

import * as SearchModel from 'containers/Search/model'
import * as Model from 'model'
import * as Log from 'utils/Logging'

import * as Content from '../Content'
import * as Tool from '../Tool'

const MODULE = 'GlobalTools/search'

const PackageFilterSchema = S.Struct({
  modified: S.optional(SearchModel.PredicatesJSON.Datetime),
  size: S.optional(SearchModel.PredicatesJSON.Number),
  name: S.optional(SearchModel.PredicatesJSON.KeywordWildcard),
  hash: S.optional(SearchModel.PredicatesJSON.KeywordWildcard),
  entries: S.optional(SearchModel.PredicatesJSON.Number),
  comment: S.optional(SearchModel.PredicatesJSON.Text),
  workflow: S.optional(SearchModel.PredicatesJSON.KeywordEnum),
})

const PackageSearchParamsSchema = S.Struct({
  resultType: S.Literal(SearchModel.ResultType.QuiltPackage).annotations({
    title: 'result type: Quilt Package',
  }),
  filter: S.optional(PackageFilterSchema).annotations({
    title: 'result filters',
  }),
  userMetaFilters: S.optional(SearchModel.UserMetaFiltersSchema).annotations({
    title: 'user metadata filters',
    description: 'a map of user metadata field paths to predicate values',
  }),
}).annotations({
  title: 'package-specific search parameters',
})

const ObjectFilterSchema = S.Struct({
  modified: S.optional(SearchModel.PredicatesJSON.Datetime),
  size: S.optional(SearchModel.PredicatesJSON.Number),
  ext: S.optional(SearchModel.PredicatesJSON.KeywordEnum).annotations({
    title: 'file extensions (with a leading dot)',
  }),
  key: S.optional(SearchModel.PredicatesJSON.KeywordWildcard),
  content: S.optional(SearchModel.PredicatesJSON.Text),
  deleted: S.optional(SearchModel.PredicatesJSON.Boolean),
})

const ObjectSearchParamsSchema = S.Struct({
  resultType: S.Literal(SearchModel.ResultType.S3Object).annotations({
    title: 'result type: S3 Object',
  }),
  filter: S.optional(ObjectFilterSchema).annotations({
    title: 'result filters',
  }),
}).annotations({
  title: 'object-specific search parameters',
})

const SearchParamsSchema = S.Struct({
  searchString: S.optional(S.String).annotations({
    title: 'search string',
    description: 'string to search for, ElasticSearch syntax supported',
  }),
  buckets: S.Array(S.String).annotations({
    title: 'search buckets',
    description: 'a list of buckets to search in (keep empty to search in all buckets)',
  }),
  order: S.Enums(Model.GQLTypes.SearchResultOrder).annotations({
    title: 'search order',
    description: 'order of search results',
  }),
  params: S.Union(PackageSearchParamsSchema, ObjectSearchParamsSchema).annotations({
    title: 'result type-specific parameters',
  }),
}).annotations({
  title: 'search parameters',
  description: 'Start a search session',
})

type SearchParams = S.Schema.Type<typeof SearchParamsSchema>

function searchUrlStateFromSearchParams({
  params,
  searchString,
  ...rest
}: SearchParams): SearchModel.SearchUrlState {
  const base = { searchString: searchString ?? null, ...rest }
  switch (params.resultType) {
    case SearchModel.ResultType.S3Object:
      return {
        ...base,
        resultType: params.resultType,
        filter: SearchModel.ObjectsSearchFilterIO.fromJSON(params.filter),
      }
    case SearchModel.ResultType.QuiltPackage:
      return {
        ...base,
        resultType: params.resultType,
        filter: SearchModel.PackagesSearchFilterIO.fromJSON({}),
        userMetaFilters: SearchModel.UserMetaFilters.fromJSON(params.userMetaFilters),
      }
    default:
      return Eff.absurd<never>(params)
  }
}

export function useStartSearch() {
  const makeUrl = SearchModel.useMakeUrl()
  const history = useHistory()
  return Tool.useMakeTool(
    SearchParamsSchema,
    (params) =>
      Log.scoped({
        name: `${MODULE}.startSearch`,
        enter: [Log.br, 'params:', params],
      })(
        Eff.Effect.gen(function* () {
          const url = makeUrl(searchUrlStateFromSearchParams(params))
          yield* Eff.Effect.sync(() => history.push(url))
          return Eff.Option.some(
            Tool.succeed(
              Content.ToolResultContentBlock.Text({
                text: 'Navigating to the search page and starting the search session. Use catalog_search_getResults tool to get the search results.',
              }),
            ),
          )
        }),
      ),
    [makeUrl, history],
  )
}
