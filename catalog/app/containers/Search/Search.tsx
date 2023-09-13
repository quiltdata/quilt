import * as React from 'react'
import * as M from '@material-ui/core'

import Layout from 'components/Layout'
// import * as SearchResults from 'components/SearchResults'
// import * as BucketConfig from 'utils/BucketConfig'
import * as GQL from 'utils/GraphQL'
import MetaTitle from 'utils/MetaTitle'
import assertNever from 'utils/assertNever'

import * as SearchUIModel from './model'

type FilterWidgetProps<T extends SearchUIModel.KnownFacetType> =
  SearchUIModel.StateForFacetType<T>

function ResultTypeFilterWidget({
  value,
}: FilterWidgetProps<typeof SearchUIModel.FacetTypes.ResultType>) {
  return <>type: {value}</>
}

function BucketFilterWidget({
  value,
}: FilterWidgetProps<typeof SearchUIModel.FacetTypes.Bucket>) {
  return <>bucket: {value.join(',')}</>
}

function NumberFilterWidget({
  value,
  extents,
}: FilterWidgetProps<typeof SearchUIModel.FacetTypes.Number>) {
  return (
    <>
      num: {value.min} ... {value.max} ({extents.min} ... {extents.max})
    </>
  )
}

const FILTER_WIDGETS = {
  ResultType: ResultTypeFilterWidget,
  Bucket: BucketFilterWidget,
  Number: NumberFilterWidget,
}

function renderFilterWidget<F extends SearchUIModel.KnownFacetDescriptor>(facet: F) {
  // eslint-disable-next-line no-underscore-dangle
  const FilterWidget = FILTER_WIDGETS[facet.type._tag]
  // @ts-expect-error
  return <FilterWidget {...facet.state} />
}

interface FacetWidgetProps {
  facet: SearchUIModel.KnownFacetDescriptor
}

function FacetWidget({ facet }: FacetWidgetProps) {
  // actions: deactivate, adjust
  // TODO: facet query (request extents if required)
  return (
    <div>
      <div>
        {/* eslint-disable-next-line no-underscore-dangle */}
        {facet.path} ({facet.type._tag})
      </div>
      {renderFilterWidget(facet)}
    </div>
  )
}

function ActiveFacets() {
  const model = SearchUIModel.use()
  return (
    <>
      {model.state.activeFacets.map((facet, i) => (
        <FacetWidget key={i} facet={facet} />
      ))}
    </>
  )
}

function AvailableFacet({ name, descriptor: { path } }: SearchUIModel.AvailableFacet) {
  const model = SearchUIModel.use()
  return (
    <button onClick={() => model.actions.activateFacet(path)}>
      {name}
      {path}
    </button>
  )
}

function AvailableFacets() {
  const model = SearchUIModel.use()
  return (
    <>
      {model.state.availableFacets.facets.map((facet, i) => (
        // TODO: infer unique key (serialize path?)
        <AvailableFacet key={i} {...facet} />
      ))}
    </>
  )
}

function Filters() {
  return (
    <div>
      <h1>filter by</h1>
      <ActiveFacets />
      <AvailableFacets />
    </div>
  )
}

interface SearchHitProps {
  hit: SearchUIModel.SearchHit
}

function SearchHit({ hit }: SearchHitProps) {
  return (
    <div>
      <div>
        {hit.__typename}:{hit.bucket}:
        {hit.__typename === 'SearchHitObject'
          ? `${hit.key}@${hit.version}`
          : `${hit.name}@${hit.hash}`}
      </div>
      {JSON.stringify(hit)}
    </div>
  )
}

interface ResultsPageProps {
  hits: readonly SearchUIModel.SearchHit[]
  cursor: string | null
}

function ResultsPage({ hits, cursor }: ResultsPageProps) {
  // const model = SearchUIModel.use()
  const [more, setMore] = React.useState(false)
  const loadMore = React.useCallback(() => {
    setMore(true)
  }, [])
  return (
    <div>
      {hits.map((hit) => (
        <SearchHit key={SearchUIModel.searchHitId(hit)} hit={hit} />
      ))}
      {!!cursor &&
        (more ? (
          <NextPage after={cursor} />
        ) : (
          <button onClick={loadMore}>load more</button>
        ))}
    </div>
  )
}

interface NextPageProps {
  after: string
}

function NextPage({ after }: NextPageProps) {
  const pageQ = SearchUIModel.useNextPageQuery(after)
  return GQL.fold(pageQ, {
    data: ({ searchMore: r }) => {
      switch (r.__typename) {
        case 'SearchResultSetPage':
          return <ResultsPage hits={r.hits} cursor={r.cursor} />
        case 'InvalidInput':
          // should not happen
          return <p>invalid input: {r.errors[0].message}</p>
        case 'OperationError':
          // should not happen. retry?
          return <p>operation error: {r.message}</p>
        default:
          assertNever(r)
      }
    },
    fetching: () => <p>loading...</p>,
    error: (err) => {
      // eslint-disable-next-line no-console
      console.error(err)
      return <p>gql error: {err.message}</p>
    },
  })
}

function FirstPage() {
  const model = SearchUIModel.use()
  return GQL.fold(model.firstPageQuery, {
    data: ({ search: r }) => {
      switch (r.__typename) {
        case 'BoundedSearch':
          return (
            <ResultsPage
              hits={r.results.firstPage.hits}
              cursor={r.results.firstPage.cursor}
            />
          )
        case 'UnboundedSearch':
          // should not happen
          return <p>unbounded search</p>
        case 'InvalidInput':
          // should not happen
          return <p>invalid input: {r.errors[0].message}</p>
        case 'OperationError':
          // should not happen
          return <p>operation error: {r.message}</p>
        default:
          assertNever(r)
      }
    },
    fetching: () => <p>loading...</p>,
    error: (err) => {
      // eslint-disable-next-line no-console
      console.error(err)
      return <p>gql error: {err.message}</p>
    },
  })
}

interface ResultsBoundedProps {
  total: number
}

function ResultsBounded({ total }: ResultsBoundedProps) {
  const model = SearchUIModel.use()
  // action: change sort order
  return (
    <div>
      <div>{total} results</div>
      <div>
        sort order: {model.state.order.field} {model.state.order.direction}
      </div>
      <div>
        <FirstPage />
      </div>
    </div>
  )
}

function ResultsUnbounded() {
  return <p>Specify search criteria</p>
}

function Results() {
  const model = SearchUIModel.use()
  return GQL.fold(model.baseSearchQuery, {
    data: ({ search: r }) => {
      switch (r.__typename) {
        case 'BoundedSearch':
          return <ResultsBounded total={r.results.total} />
        case 'UnboundedSearch':
          return <ResultsUnbounded />
        case 'InvalidInput':
          return <p>invalid input: {r.errors[0].message}</p>
        case 'OperationError':
          return <p>operation error: {r.message}</p>
        default:
          assertNever(r)
      }
    },
    fetching: () => <p>loading...</p>,
    error: (err) => {
      // eslint-disable-next-line no-console
      console.error(err)
      return <p>gql error: {err.message}</p>
    },
  })
}

function SearchLayout() {
  const model = SearchUIModel.use()
  return (
    <Layout
      pre={
        <M.Container maxWidth="lg">
          <MetaTitle>{model.state.searchString || 'Search'}</MetaTitle>
          <Filters />
          <Results />
        </M.Container>
      }
    />
  )
}

export default function Search() {
  return (
    <SearchUIModel.Provider>
      <SearchLayout />
    </SearchUIModel.Provider>
  )
}
