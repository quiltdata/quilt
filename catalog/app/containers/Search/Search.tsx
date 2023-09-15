import * as React from 'react'
import * as M from '@material-ui/core'

import Layout from 'components/Layout'
// import * as SearchResults from 'components/SearchResults'
// import * as BucketConfig from 'utils/BucketConfig'
import * as GQL from 'utils/GraphQL'
import MetaTitle from 'utils/MetaTitle'
import assertNever from 'utils/assertNever'

import * as SearchUIModel from './model'

interface FacetActions<T extends SearchUIModel.KnownFacetType> {
  // XXX: accept updater fn?
  onChange: (value: SearchUIModel.StateForFacetType<T>['value']) => void
  // TODO: onChangeExtents
  onDeactivate: () => void
}

type FilterWidgetProps<T extends SearchUIModel.KnownFacetType> =
  SearchUIModel.StateForFacetType<T> & FacetActions<T>

function ResultTypeSelector() {
  const model = SearchUIModel.use()
  const { setResultType } = model.actions
  const onSelect = React.useCallback(
    (e) => {
      setResultType((e.target.value || null) as SearchUIModel.ResultType | null)
    },
    [setResultType],
  )

  const selectValue = model.state.resultType ?? ''
  return (
    <div>
      <div>type:</div>
      <select value={selectValue} onChange={onSelect}>
        <option value={SearchUIModel.ResultType.S3Object}>objects</option>
        <option value={SearchUIModel.ResultType.QuiltPackage}>packages</option>
        <option value={''}>both</option>
      </select>
    </div>
  )
}

function BucketSelector() {
  const model = SearchUIModel.use()
  // use model.actions.setBuckets
  return <div>bucket(s): {model.state.buckets.join(',') || 'all'}</div>
}

function NumberFilterWidget({
  value,
  extents, // onChange, ,
  onDeactivate,
}: FilterWidgetProps<typeof SearchUIModel.FacetTypes.Number>) {
  return (
    <div>
      num
      <button onClick={onDeactivate}>x</button>
      <div>
        value:
        {value.min} ... {value.max}
      </div>
      <div>
        extents:
        {extents.min} ... {extents.max}
      </div>
    </div>
  )
}

function GenericFilterWidget({
  value,
  // extents, // onChange, ,
  onDeactivate,
  ...rest
}: FilterWidgetProps<SearchUIModel.FacetType<any, any, any>>) {
  return (
    <div>
      generic
      <button onClick={onDeactivate}>x</button>
      <div>value: {JSON.stringify(value)}</div>
      <div>extents: {JSON.stringify((rest as any).extents)}</div>
    </div>
  )
}

const FILTER_WIDGETS = {
  Number: NumberFilterWidget,
  Date: GenericFilterWidget,
  Keyword: GenericFilterWidget,
  Text: GenericFilterWidget,
  Boolean: GenericFilterWidget,
}

function renderFilterWidget<F extends SearchUIModel.KnownFacetDescriptor>(
  facet: F,
  actions: FacetActions<F['type']>,
) {
  // eslint-disable-next-line no-underscore-dangle
  const FilterWidget = FILTER_WIDGETS[facet.type._tag]
  // @ts-expect-error
  return <FilterWidget {...facet.state} {...actions} />
}

interface FacetWidgetProps<F extends SearchUIModel.KnownFacetDescriptor> {
  facet: F
}

function FacetWidget<F extends SearchUIModel.KnownFacetDescriptor>({
  facet,
}: FacetWidgetProps<F>) {
  type FacetType = typeof facet.type

  const model = SearchUIModel.use()
  const { deactivateFacet, updateActiveFacet } = model.actions

  const actions: FacetActions<FacetType> = {
    onDeactivate: React.useCallback(() => {
      deactivateFacet(facet.path)
    }, [facet.path, deactivateFacet]),
    onChange: React.useCallback(
      (value) => {
        // @ts-expect-error
        updateActiveFacet(facet.path, (f) => ({ ...f, state: { ...f.state, value } }))
      },
      [facet.path, updateActiveFacet],
    ),
  }

  return (
    <div>
      <div>
        {/* eslint-disable-next-line no-underscore-dangle */}
        {facet.path.join(' / ')} ({facet.type._tag})
      </div>
      {renderFilterWidget(facet, actions)}
    </div>
  )
}

function ActiveFacets() {
  const model = SearchUIModel.use()
  return (
    <>
      {model.state.activeFacets.map((facet) => (
        <FacetWidget key={JSON.stringify(facet.path)} facet={facet} />
      ))}
    </>
  )
}

function AvailableFacet({ path }: SearchUIModel.AvailableFacet) {
  const model = SearchUIModel.use()
  return (
    <button onClick={() => model.actions.activateFacet(path)}>{path.join(' / ')}</button>
  )
}

function AvailableFacets() {
  const model = SearchUIModel.use()
  return (
    <>
      {model.state.availableFacets.facets.map((facet) => (
        <AvailableFacet key={JSON.stringify(facet.path)} {...facet} />
      ))}
    </>
  )
}

function Filters() {
  return (
    <div>
      <h1>filter by</h1>
      <ResultTypeSelector />
      <BucketSelector />
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
      <pre>{JSON.stringify(hit, null, 2)}</pre>
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
        <SearchHit key={hit.id} hit={hit} />
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
