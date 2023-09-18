import * as React from 'react'
import * as M from '@material-ui/core'

import Layout from 'components/Layout'
// import * as SearchResults from 'components/SearchResults'
// import * as BucketConfig from 'utils/BucketConfig'
import * as GQL from 'utils/GraphQL'
import MetaTitle from 'utils/MetaTitle'
import assertNever from 'utils/assertNever'
import * as JSONPointer from 'utils/JSONPointer'

import * as FiltersWidgets from './Filters'
import * as SearchUIModel from './model'

interface FacetActions<T extends SearchUIModel.KnownFacetType> {
  // XXX: accept updater fn?
  onChange: (value: SearchUIModel.StateForFacetType<T>['value']) => void
  // TODO: onChangeExtents
  onDeactivate: () => void
}

type FilterWidgetProps<T extends SearchUIModel.KnownFacetType> =
  SearchUIModel.StateForFacetType<T> & FacetActions<T>

function ResultTypeFilterWidget({
  value,
  onChange, // onDeactivate,
}: FilterWidgetProps<typeof SearchUIModel.FacetTypes.ResultType>) {
  const selectValue = value ?? ''
  return (
    <FiltersWidgets.Type
      value={selectValue}
      onChange={(t) => onChange((t || null) as SearchUIModel.ResultType)}
    />
  )
}

function BucketFilterWidget({
  value, // onChange, onDeactivate,
  onChange,
}: FilterWidgetProps<typeof SearchUIModel.FacetTypes.Bucket>) {
  return <FiltersWidgets.BucketExtented value={value} onChange={onChange} />
}

function NumberFilterWidget({
  path,
  value,
  extents,
  onChange,
  onDeactivate,
}: FilterWidgetProps<typeof SearchUIModel.FacetTypes.Number> & { path: string[] }) {
  const type = JSONPointer.stringify(path)
  const Component =
    type === '/pkg/total_entries' ? FiltersWidgets.TotalEntries : FiltersWidgets.TotalSize
  return (
    <Component
      onDeactivate={onDeactivate}
      value={
        value.min === null || value.min === null
          ? null
          : ([value.min, value.max] as [number, number])
      }
      extents={
        extents.min === null || extents.min === null
          ? null
          : ([extents.min, extents.max] as [number, number])
      }
      onChange={(newValues) =>
        newValues === null
          ? onChange({ min: null, max: null })
          : onChange({ min: newValues[0], max: newValues[1] })
      }
    />
  )
}

const FILTER_WIDGETS = {
  ResultType: ResultTypeFilterWidget,
  Bucket: BucketFilterWidget,
  Number: NumberFilterWidget,
}

function renderFilterWidget<F extends SearchUIModel.KnownFacetDescriptor>(
  facet: F,
  actions: FacetActions<F['type']>,
) {
  // eslint-disable-next-line no-underscore-dangle
  const FilterWidget = FILTER_WIDGETS[facet.type._tag]
  // @ts-expect-error
  return <FilterWidget path={facet.path} {...facet.state} {...actions} />
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
      {model.state.activeFacets.map((facet, i) => (
        <FacetWidget key={i} facet={facet} />
      ))}
    </>
  )
}

function AvailableFacet({ name, descriptor: { path } }: SearchUIModel.AvailableFacet) {
  const model = SearchUIModel.use()
  return <M.Chip onClick={() => model.actions.activateFacet(path)} label={name} />
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

const useStyles = M.makeStyles((t) => ({
  root: {
    display: 'grid',
    gridTemplateColumns: `${t.spacing(40)}px auto`,
    gridGapColumn: t.spacing(2),
  },
}))

function SearchLayout() {
  const model = SearchUIModel.use()
  const classes = useStyles()
  return (
    <Layout
      pre={
        <M.Container maxWidth="lg" className={classes.root}>
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
