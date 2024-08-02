import * as Eff from 'effect'
import * as React from 'react'

import * as Assistant from 'components/Assistant'
import * as GQL from 'utils/GraphQL'

import * as SearchUIModel from './model'

type AttrValue = string | number

type Attrs = Record<string, AttrValue>

type Child = XMLTag | string | null

type Children = Child[]

class XMLTag {
  readonly name: string

  readonly attrsProp: Attrs

  readonly childrenProp: Children

  constructor(name: string, attrs: Attrs, children: Children) {
    this.name = name
    this.attrsProp = attrs
    this.childrenProp = children
  }

  static make(name: string, attrs: Attrs = {}, ...children: Children) {
    return new XMLTag(name, attrs, children)
  }

  attrs(attrs: Attrs) {
    return new XMLTag(this.name, { ...this.attrsProp, ...attrs }, this.childrenProp)
  }

  children(...children: Children) {
    return new XMLTag(this.name, this.attrsProp, [...this.childrenProp, ...children])
  }

  toString(): string {
    const attrs = Object.entries(this.attrsProp)
      .map(([k, v]) => ` ${k}=${JSON.stringify(v)}`)
      .join('')

    const children = Eff.pipe(
      this.childrenProp,
      Eff.Array.filterMap(
        Eff.flow(
          Eff.Option.fromNullable,
          Eff.Option.map((c) => (typeof c === 'string' ? c : c.toString())),
        ),
      ),
    )

    const parts = [`<${this.name}${attrs}>`, ...children, `</${this.name}>`]

    return parts.join('\n')
  }
}

const resultTypeDisplay = (resultType: SearchUIModel.ResultType) =>
  resultType === SearchUIModel.ResultType.S3Object ? 'objects' : 'packages'

type BaseData = NonNullable<SearchUIModel.SearchUIModel['baseSearchQuery']['data']>

type ObjectsStats = Extract<
  BaseData['searchObjects'],
  { __typename: 'ObjectsSearchResultSet' }
>['stats']

type ObjectsFacets = Omit<ObjectsStats, 'total' | '__typename'>

type PackagesStats = Extract<
  BaseData['searchPackages'],
  { __typename: 'PackagesSearchResultSet' }
>['stats']

type PackageFacets = Omit<PackagesStats, 'total' | '__typename'>

type BaseStats = {
  [s in 'these' | 'other']: Eff.Either.Either<
    Eff.Option.Option<ObjectsStats | PackagesStats>,
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

function getBaseStats(
  baseSearchQuery: SearchUIModel.SearchUIModel['baseSearchQuery'],
  resultType: SearchUIModel.ResultType,
): MaybeEither<BaseStats, string> {
  return GQL.fold(baseSearchQuery, {
    data: (d) => {
      const objects = Eff.pipe(d.searchObjects, (r) => {
        switch (r.__typename) {
          case 'InvalidInput':
            return Eff.Either.left('InvalidInput')
          case 'EmptySearchResultSet':
            return Eff.Either.right(Eff.Option.none())
          case 'ObjectsSearchResultSet':
            return Eff.Either.right(Eff.Option.some(r.stats))
        }
      })
      const packages = Eff.pipe(d.searchPackages, (r) => {
        switch (r.__typename) {
          case 'InvalidInput':
            return Eff.Either.left('InvalidInput')
          case 'EmptySearchResultSet':
            return Eff.Either.right(Eff.Option.none())
          case 'PackagesSearchResultSet':
            return Eff.Either.right(Eff.Option.some(r.stats))
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
          case 'EmptySearchResultSet':
            return Eff.Either.right({ hits: [], total: 0 })
          case 'ObjectsSearchResultSet':
          case 'PackagesSearchResultSet':
            return Eff.Either.right({ hits: d.firstPage.hits, total: d.stats.total })
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
          getBaseStats(model.baseSearchQuery, resultType),
          getFirstPage(model.firstPageQuery),
        ]),
        Eff.Option.map(([baseStatsE, firstPageE]) =>
          Eff.Either.gen(function* () {
            const baseStats = yield* baseStatsE
            const { these, other } = yield* Eff.Either.all(baseStats)
            const firstPage = yield* firstPageE
            return {
              resultType,
              otherType,
              totalBeforeFilters: Eff.Option.match(these, {
                onNone: () => 0,
                onSome: (stats) => stats.total,
              }),
              totalAfterFilters: firstPage.total,
              totalOther: Eff.Option.match(other, {
                onNone: () => 0,
                onSome: (stats) => stats.total,
              }),
              facets: Eff.Option.map(these, ({ __typename, total, ...facets }) => facets),
              firstPage: firstPage.hits,
            }
          }),
        ),
      ),
    [model.baseSearchQuery, model.firstPageQuery, resultType, otherType],
  )
}

function useSearchContext() {
  const ctxO = useSearchContextModel()

  const tag = React.useMemo(() => {
    if (Eff.Option.isNone(ctxO)) {
      return XMLTag.make(
        'search-results',
        { status: 'pending' },
        'Loading search results...',
      )
    }
    const ctxE = ctxO.value
    if (Eff.Either.isLeft(ctxE)) {
      return XMLTag.make(
        'search-results',
        { status: 'error' },
        `Unexpected errors while loading search results: ${ctxE.left}`,
      )
    }

    const ctx = ctxE.right

    const meta = XMLTag.make(
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
          XMLTag.make(
            'facets',
            {},
            'Search facets aggregated from the result set:',
            JSON.stringify(facets, null, 2),
          ),
      }),
      `Total **${resultTypeDisplay(
        ctx.otherType,
      )}** found matching the same criteria before applying filters: ${ctx.totalOther}`,
    )

    let hits = XMLTag.make('hits', {})
    if (ctx.firstPage.length) {
      hits = hits.children(
        XMLTag.make(
          'page',
          { number: 1 },
          ...ctx.firstPage.map((hit, index) =>
            XMLTag.make('search-result', { index }, JSON.stringify(hit, null, 2)),
          ),
        ),
      )
    } else {
      hits = hits.children('Search request returned no results')
    }

    return XMLTag.make('search-results', { status: 'success' }, meta, hits)
  }, [ctxO])

  return {
    // TODO: implement context markers
    // markers: {
    //   searchResultsReady: Eff.Option.isSome(ctxO),
    // },
    messages: [React.useMemo(() => tag.toString(), [tag])],
  }
}

export default function AssistantContext() {
  Assistant.Context.usePushContext(useSearchContext())
  return null
}
