import * as Eff from 'effect'
import * as React from 'react'
import { Schema as S } from '@effect/schema'

import * as Assistant from 'components/Assistant'
// import * as Model from 'model'
import { runtime } from 'utils/Effect'
import useConstant from 'utils/useConstant'

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

function useMessages(model: SearchUIModel.SearchUIModel) {
  return [intro(model)]
}

// const RefineSearchSchema = S.Struct({
//   searchString: S.optional(S.String).annotations({
//     description: 'set search string',
//   }),
//   order: S.optional(S.Enums(Model.GQLTypes.SearchResultOrder)).annotations({
//     description: 'set result order',
//   }),
//   resultType: S.optional(S.Enums(SearchUIModel.ResultType)).annotations({
//     description: 'set result type',
//   }),
//   buckets: S.optional(S.Array(S.String)).annotations({
//     description: 'select buckets to search in (keep empty to search in all buckets)',
//   }),
// }).annotations({
//   description:
//     'Refine current search by adjusting search parameters. Dont provide a parameter to keep it as is',
// })

const GetResultsSchema = S.Struct({
  dummy: S.optional(S.String).annotations({
    description: 'not used',
  }),
}).annotations({
  description: 'Get current search results',
})

function useGetResults(model: SearchUIModel.SearchUIModel) {
  const result: Eff.Option.Option<Assistant.Model.Tool.Result> = React.useMemo(
    () =>
      Eff.Match.value(model.firstPageQuery).pipe(
        Eff.Match.tag('fetching', () => Eff.Option.none()),
        Eff.Match.tag('error', (r) =>
          Eff.Option.some(
            Assistant.Model.Tool.Result({
              status: 'error',
              content: [
                Assistant.Model.Content.text(
                  `Search request failed with error:\n${JSON.stringify(r.error)}`,
                ),
              ],
            }),
          ),
        ),
        Eff.Match.tag('data', (r) =>
          Eff.Match.value(r.data).pipe(
            Eff.Match.when({ __typename: 'InvalidInput' }, (data) =>
              Eff.Option.some(
                Assistant.Model.Tool.Result({
                  status: 'error',
                  content: [
                    Assistant.Model.Content.text(
                      `Search request failed with error:\n${JSON.stringify(data)}`,
                    ),
                  ],
                }),
              ),
            ),
            Eff.Match.when({ __typename: 'EmptySearchResultSet' }, () =>
              Eff.Option.some(
                Assistant.Model.Tool.Result({
                  status: 'success',
                  content: [
                    Assistant.Model.Content.text('Search request returned no results'),
                  ],
                }),
              ),
            ),
            Eff.Match.orElse((data) => {
              // 'ObjectsSearchResultSet'
              // 'PackagesSearchResultSet'
              const label =
                data.__typename === 'ObjectsSearchResultSet' ? 'objects' : 'packages'
              return Eff.Option.some(
                Assistant.Model.Tool.Result({
                  status: 'success',
                  content: [
                    Assistant.Model.Content.text(
                      `Found ${data.stats.total} ${label}. First page follows:`,
                    ),
                    ...data.firstPage.hits.map((hit, i) =>
                      Assistant.Model.Content.text(
                        `<search-result index=${i}>\n${JSON.stringify(
                          hit,
                          null,
                          2,
                        )}\n</search-result>`,
                      ),
                    ),
                  ],
                }),
              )
            }),
          ),
        ),
        Eff.Match.exhaustive,
      ),
    [model.firstPageQuery],
  )

  const ref = useConstant(() => runtime.runSync(Eff.SubscriptionRef.make(result)))

  React.useEffect(() => {
    runtime.runFork(Eff.SubscriptionRef.set(ref, result))
  }, [result, ref])

  return Assistant.Model.Tool.useMakeTool(
    GetResultsSchema,
    () =>
      Eff.Effect.gen(function* () {
        yield* Eff.Console.debug('tool: get search results')
        // wait til results are Some
        const lastOpt = yield* ref.changes.pipe(
          Eff.Stream.takeUntil((x) => Eff.Option.isSome(x)),
          Eff.Stream.runLast,
        )
        const last = Eff.Option.flatten(lastOpt)
        // should be some
        const res = Eff.Option.match(last, {
          onSome: (value) => value,
          onNone: () =>
            Assistant.Model.Tool.Result({
              status: 'error',
              content: [Assistant.Model.Content.text('Got empty results')],
            }),
        })
        return Eff.Option.some(res)
      }),
    [ref],
  )
}

const withPrefix = <T extends Record<string, any>>(prefix: string, obj: T) =>
  Object.entries(obj).reduce((acc, [k, v]) => ({ ...acc, [prefix + k]: v }), {})

function useTools(model: SearchUIModel.SearchUIModel) {
  // const {
  //   updateUrlState,
  //   // setSearchString,
  //   // setOrder,
  //   // setResultType,
  //   // setBuckets,
  //   //
  //   // activateObjectsFilter,
  //   // deactivateObjectsFilter,
  //   // setObjectsFilter,
  //   //
  //   // activatePackagesFilter,
  //   // deactivatePackagesFilter,
  //   // setPackagesFilter,
  //   //
  //   // activatePackagesMetaFilter,
  //   // deactivatePackagesMetaFilter,
  //   // setPackagesMetaFilter,
  //   //
  //   // clearFilters,
  //   // reset,
  // } = model.actions

  return withPrefix('catalog_search_', {
    // refine: Assistant.Model.Tool.useMakeTool(
    //   RefineSearchSchema,
    //   (params) =>
    //     Eff.Effect.gen(function* () {
    //       yield* Eff.Effect.sync(() =>
    //         updateUrlState((s) => ({ ...s, ...(params as any) })),
    //       )
    //       return Eff.Option.some(
    //         Assistant.Model.Tool.Result({
    //           status: 'success',
    //           content: [
    //             Assistant.Model.Content.text(
    //               'Search parameters updated. Use catalog_search_getResults tool to get the search results.',
    //             ),
    //           ],
    //         }),
    //       )
    //     }),
    //   [updateUrlState],
    // ),
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
    getResults: useGetResults(model),
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
