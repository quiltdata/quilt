import * as Eff from 'effect'
import * as React from 'react'

import * as Assistant from 'components/Assistant'
import * as GQL from 'utils/GraphQL'
import * as XML from 'utils/XML'

import * as SearchUIModel from './model'

const resultTypeDisplay = (resultType: SearchUIModel.ResultType) =>
  resultType === SearchUIModel.ResultType.S3Object ? 'objects' : 'packages'

type BaseData = NonNullable<SearchUIModel.SearchUIModel['baseSearchQuery']['data']>

type Objects = Extract<
  BaseData['searchObjects'],
  { __typename: 'ObjectsSearchResultSet' }
>

type ObjectsFacets = Omit<Objects['stats'], '__typename'>

type Packages = Extract<
  BaseData['searchPackages'],
  { __typename: 'PackagesSearchResultSet' }
>

type PackageFacets = Omit<Packages['stats'], '__typename'>

type Base = {
  [s in 'these' | 'other']: Eff.Either.Either<
    Eff.Option.Option<Objects | Packages>,
    string
  >
}

type FirstPageData = Extract<
  SearchUIModel.SearchUIModel['firstPageQuery'],
  { _tag: 'data' }
>['data']

type FirstPageResultSet = Extract<
  FirstPageData,
  { __typename: 'ObjectsSearchResultSet' | 'PackagesSearchResultSet' }
>

type FirstPageHits = FirstPageResultSet['firstPage']['hits']

interface SearchContext {
  resultType: SearchUIModel.ResultType
  otherType: SearchUIModel.ResultType
  totalBeforeFilters: number
  totalAfterFilters: number
  totalOther: number
  facets: Eff.Option.Option<ObjectsFacets | PackageFacets>
  firstPage: FirstPageHits
}

type MaybeEither<A, E> = Eff.Option.Option<Eff.Either.Either<A, E>>

type MaybeEitherSearchContext = MaybeEither<SearchContext, string>

function getBase(
  baseSearchQuery: SearchUIModel.SearchUIModel['baseSearchQuery'],
  resultType: SearchUIModel.ResultType,
): MaybeEither<Base, string> {
  return GQL.fold(baseSearchQuery, {
    data: (d) => {
      const objects = Eff.pipe(d.searchObjects, (r) => {
        switch (r.__typename) {
          case 'InvalidInput':
            return Eff.Either.left('InvalidInput')
          case 'OperationError':
            return Eff.Either.left(r.name)
          case 'EmptySearchResultSet':
            return Eff.Either.right(Eff.Option.none())
          case 'ObjectsSearchResultSet':
            return Eff.Either.right(Eff.Option.some(r))
        }
      })
      const packages = Eff.pipe(d.searchPackages, (r) => {
        switch (r.__typename) {
          case 'InvalidInput':
            return Eff.Either.left('InvalidInput')
          case 'OperationError':
            return Eff.Either.left(r.name)
          case 'EmptySearchResultSet':
            return Eff.Either.right(Eff.Option.none())
          case 'PackagesSearchResultSet':
            return Eff.Either.right(Eff.Option.some(r))
          default:
            return Eff.absurd<never>(r)
        }
      })
      const [these, other] =
        resultType === SearchUIModel.ResultType.QuiltPackage
          ? [packages, objects]
          : [objects, packages]
      return Eff.Option.some(Eff.Either.right({ these, other }))
    },
    fetching: () => Eff.Option.none(),
    error: (e) => Eff.Option.some(Eff.Either.left(e.name)),
  })
}

function getFirstPage(
  fpq: SearchUIModel.SearchUIModel['firstPageQuery'],
): MaybeEither<{ hits: FirstPageHits; total: number }, string> {
  return Eff.Option.gen(function* () {
    switch (fpq._tag) {
      case 'fetching':
        return yield* Eff.Option.none()
      case 'error':
        return Eff.Either.left(fpq.error.name)
      case 'data':
        const d = fpq.data
        switch (d.__typename) {
          case 'InvalidInput':
            return Eff.Either.left('InvalidInput')
          case 'OperationError':
            return Eff.Either.left(d.name)
          case 'EmptySearchResultSet':
            return Eff.Either.right({ hits: [], total: 0 })
          case 'ObjectsSearchResultSet':
          case 'PackagesSearchResultSet':
            return Eff.Either.right({ hits: d.firstPage.hits, total: d.total })
          default:
            return Eff.absurd<never>(d)
        }
      default:
        return Eff.absurd<never>(fpq)
    }
  })
}

function useSearchContextModel(): MaybeEitherSearchContext {
  const model = SearchUIModel.use()

  const resultType = model.state.resultType
  const otherType =
    resultType === SearchUIModel.ResultType.S3Object
      ? SearchUIModel.ResultType.QuiltPackage
      : SearchUIModel.ResultType.S3Object

  return React.useMemo(
    () =>
      Eff.pipe(
        Eff.Option.all([
          getBase(model.baseSearchQuery, resultType),
          getFirstPage(model.firstPageQuery),
        ]),
        Eff.Option.map(([baseE, firstPageE]) =>
          Eff.Either.gen(function* () {
            const base = yield* baseE
            const { these, other } = yield* Eff.Either.all(base)
            const firstPage = yield* firstPageE
            return {
              resultType,
              otherType,
              totalBeforeFilters: Eff.Option.match(these, {
                onNone: () => 0,
                onSome: ({ total }) => total,
              }),
              totalAfterFilters: firstPage.total,
              totalOther: Eff.Option.match(other, {
                onNone: () => 0,
                onSome: ({ total }) => total,
              }),
              facets: Eff.Option.map(
                these,
                ({ stats: { __typename, ...facets } }) => facets,
              ),
              firstPage: firstPage.hits,
            }
          }),
        ),
      ),
    [model.baseSearchQuery, model.firstPageQuery, resultType, otherType],
  )
}

const MAX_CONTENT_LENGTH = 10_000

function truncateIndexedContent(hit: FirstPageHits[number]) {
  switch (hit.__typename) {
    case 'SearchHitObject':
      return (hit.indexedContent?.length ?? 0) > MAX_CONTENT_LENGTH
        ? {
            ...hit,
            indexedContent: hit.indexedContent?.slice(0, MAX_CONTENT_LENGTH),
            indexedContentTruncated: true,
          }
        : hit
    default:
      return hit
  }
}

function useSearchContext() {
  const ctxO = useSearchContextModel()

  const tag = React.useMemo(() => {
    if (Eff.Option.isNone(ctxO)) {
      return XML.tag('search-results', { status: 'pending' }, 'Loading search results...')
    }
    const ctxE = ctxO.value
    if (Eff.Either.isLeft(ctxE)) {
      return XML.tag(
        'search-results',
        { status: 'error' },
        `Unexpected errors while loading search results: ${ctxE.left}`,
      )
    }

    const ctx = ctxE.right

    const meta = XML.tag(
      'metadata',
      {},
      `Total **${resultTypeDisplay(ctx.resultType)}** found before applying filters: ${
        ctx.totalBeforeFilters
      }`,
      `Total **${resultTypeDisplay(ctx.resultType)}** found after applying filters: ${
        ctx.totalAfterFilters
      }`,
      Eff.Option.match(ctx.facets, {
        onNone: () => null,
        onSome: (facets) =>
          XML.tag(
            'facets',
            {},
            'Search facets aggregated from the result set:',
            JSON.stringify(facets, null, 2),
          ),
      }),
      `Total **${resultTypeDisplay(
        ctx.otherType,
      )}** found matching the same criteria before applying filters: ${ctx.totalOther}`,
      "Navigate to a specific result's page for more details.",
    )

    const hits = XML.tag(
      'hits',
      {},
      ctx.firstPage.length
        ? XML.tag(
            'page',
            { number: 1 },
            ...ctx.firstPage.map((hit, index) =>
              XML.tag(
                'search-result',
                { index },
                JSON.stringify(truncateIndexedContent(hit), null, 2),
              ),
            ),
          )
        : 'Search request returned no results',
    )

    return XML.tag('search-results', { status: 'success' }, meta, hits)
  }, [ctxO])

  return {
    markers: { searchResultsReady: Eff.Option.isSome(ctxO) },
    messages: [React.useMemo(() => tag.toString(), [tag])],
  }
}

export default Assistant.Context.LazyContext(useSearchContext)
