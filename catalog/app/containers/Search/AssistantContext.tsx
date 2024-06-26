import { Schema as S } from '@effect/schema'

import * as Assistant from 'components/Assistant'
import * as Model from 'model'
import assertNever from 'utils/assertNever'

import * as SearchUIModel from './model'

const RESULT_TYPE_LABELS = {
  [SearchUIModel.ResultType.QuiltPackage]: 'Quilt Packages',
  [SearchUIModel.ResultType.S3Object]: 'S3 Objects',
}

const intro = (model: SearchUIModel.SearchUIModel) => {
  let lines: string[] = []
  lines.push(`You see the Quilt Catalog's search page with the following parameters:`)
  lines.push('<search-parameters>')
  lines.push(`- result type: ${RESULT_TYPE_LABELS[model.state.resultType]}`)
  lines.push(`- result order: ${model.state.order}`)
  lines.push(
    model.state.searchString
      ? `- search string: ${model.state.searchString}`
      : '- search string is empty',
  )
  lines.push(
    model.state.buckets.length
      ? `- in buckets: ${model.state.buckets.join(', ')}`
      : '- in all buckets',
  )
  lines.push('</search-parameters>')
  lines.push('Prefer using local tools over global') // XXX
  return lines.join('\n')
}

const results = (model: SearchUIModel.SearchUIModel) => {
  const r = model.firstPageQuery
  switch (r._tag) {
    case 'fetching':
      return 'Search results are still loading...'
    case 'error':
      return `Search request failed with error:\n${JSON.stringify(r.error)}`
    case 'data':
      switch (r.data.__typename) {
        case 'InvalidInput':
          return `Search request failed with error:\n${JSON.stringify(r.data)}`
        case 'EmptySearchResultSet':
          return 'Search request returned no results'
        case 'ObjectsSearchResultSet':
        case 'PackagesSearchResultSet':
          return `Search request returned ${r.data.stats.total} results`
        default:
          assertNever(r.data)
      }
    default:
      assertNever(r)
  }
}

function useMessages(model: SearchUIModel.SearchUIModel) {
  return [intro(model), results(model)]
}

const RefineSearchSchema = S.Struct({
  searchString: S.optional(S.String).annotations({
    description: 'set search string',
  }),
  order: S.optional(S.Enums(Model.GQLTypes.SearchResultOrder)).annotations({
    description: 'set result order',
  }),
  resultType: S.optional(S.Enums(SearchUIModel.ResultType)).annotations({
    description: 'set result type',
  }),
  buckets: S.optional(S.Array(S.String)).annotations({
    description: 'select buckets to search in (keep empty to search in all buckets)',
  }),
}).annotations({
  description:
    'Refine current search by adjusting search parameters. Dont provide a parameter to keep it as is',
})

const withPrefix = <T extends Record<string, any>>(prefix: string, obj: T) =>
  Object.entries(obj).reduce((acc, [k, v]) => ({ ...acc, [prefix + k]: v }), {})

function useTools(model: SearchUIModel.SearchUIModel) {
  const {
    updateUrlState,
    // setSearchString,
    // setOrder,
    // setResultType,
    // setBuckets,
    //
    // activateObjectsFilter,
    // deactivateObjectsFilter,
    // setObjectsFilter,
    //
    // activatePackagesFilter,
    // deactivatePackagesFilter,
    // setPackagesFilter,
    //
    // activatePackagesMetaFilter,
    // deactivatePackagesMetaFilter,
    // setPackagesMetaFilter,
    //
    // clearFilters,
    // reset,
  } = model.actions

  return withPrefix('catalog_search_', {
    refine: Assistant.Context.useMakeTool(
      RefineSearchSchema,
      async (params) => {
        // TODO
        updateUrlState((s) => ({ ...s, ...(params as any) }))
        return []
      },
      [updateUrlState],
    ),
    //
    // activateObjectsFilter,
    // deactivateObjectsFilter,
    // setObjectsFilter,
    //
    // activatePackagesFilter,
    // deactivatePackagesFilter,
    // setPackagesFilter,
    //
    // activatePackagesMetaFilter,
    // deactivatePackagesMetaFilter,
    // setPackagesMetaFilter,
    //
    // clearFilters,
    // reset,
  })
}

export default function AssistantContext() {
  const model = SearchUIModel.use()
  Assistant.Context.usePushContext({
    tools: useTools(model),
    messages: useMessages(model),
  })
  return null
}
