import * as Eff from 'effect'
import * as React from 'react'
import { Schema as S } from '@effect/schema'

import * as Assistant from 'components/Assistant'
import { runtime } from 'utils/Effect'
import useConstant from 'utils/useConstant'

import * as SearchUIModel from './model'

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

export default function AssistantContext() {
  const model = SearchUIModel.use()
  Assistant.Context.usePushContext({
    tools: { getSearchResults: useGetResults(model) },
  })
  return null
}
