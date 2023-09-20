import * as React from 'react'
import * as M from '@material-ui/core'

import * as FiltersUI from 'components/Filters'
import Layout from 'components/Layout'
import * as SearchResults from 'components/SearchResults'
// import * as BucketConfig from 'utils/BucketConfig'
import * as GQL from 'utils/GraphQL'
import MetaTitle from 'utils/MetaTitle'
import assertNever from 'utils/assertNever'
import * as JSONPointer from 'utils/JSONPointer'

import * as SearchUIModel from './model'
import AvailableFacets from './AvailableFacets'
import BucketsFilterWidget from './Buckets'
import ResultTypeFilterWidget from './ResultType'

function pathToFilterTitle(path: SearchUIModel.FacetPath) {
  const [head, ...tail] = path
  switch (head) {
    case 'pkg':
      switch (tail[0]) {
        case 'total_size':
          return 'Total size'
        case 'total_entries':
          return 'Total entries'
      }
    case 'pkg_meta':
      return (
        <>
          Package meta <b>{tail.slice(0, -1).join(' ')}</b> {tail.slice(-1)} in:
        </>
      )
    default:
      return JSONPointer.stringify(path as string[])
  }
}

interface FacetActions<T extends SearchUIModel.KnownFacetType> {
  // XXX: accept updater fn?
  onChange: (value: SearchUIModel.StateForFacetType<T>['value']) => void
  // TODO: onChangeExtents
  onDeactivate: () => void
}

type FilterWidgetProps<T extends SearchUIModel.KnownFacetType> =
  SearchUIModel.StateForFacetType<T> & FacetActions<T> & { path: SearchUIModel.FacetPath }

function NumberFilterWidget({
  path,
  value,
  extents,
  onChange,
  onDeactivate,
}: FilterWidgetProps<typeof SearchUIModel.FacetTypes.Number>) {
  const unit = React.useMemo(() => {
    switch (JSONPointer.stringify(path)) {
      case '/pkg/total_entries':
        return 'Entries'
      case '/pkg/total_size':
        return 'Bytes'
      // no-default
    }
  }, [path])
  const hasExtents = !!((extents.min ?? false) || (extents.max ?? false))
  const hasSingleExtent = extents.min === extents.max
  return (
    <FiltersUI.Container
      defaultExpanded
      onDeactivate={onDeactivate}
      title={pathToFilterTitle(path)}
    >
      {hasExtents &&
        (hasSingleExtent ? (
          <FiltersUI.Checkbox
            label={`${extents.min} ${unit || ''}`}
            onChange={(checked) =>
              checked
                ? onChange({ min: extents.min, max: extents.max })
                : onChange({ min: null, max: null })
            }
            value={value.min === extents.min && value.max === extents.max}
          />
        ) : (
          <FiltersUI.NumbersRange
            extents={extents}
            onChange={onChange}
            unit={unit}
            value={value}
          />
        ))}
    </FiltersUI.Container>
  )
}

function DateFilterWidget({
  path,
  onDeactivate,
  onChange,
  value,
  extents,
}: FilterWidgetProps<typeof SearchUIModel.FacetTypes.Date>) {
  // FIXME: fix TS type or value type
  const fixedExtents = React.useMemo(
    () => ({
      min: extents.min === null ? extents.min : new Date(extents.min),
      max: extents.max === null ? extents.max : new Date(extents.max),
    }),
    [extents],
  )
  const fixedValue = React.useMemo(
    () => ({
      min: value.min === null ? value.min : new Date(value.min),
      max: value.max === null ? value.max : new Date(value.max),
    }),
    [value],
  )
  return (
    <FiltersUI.Container
      defaultExpanded
      onDeactivate={onDeactivate}
      title={pathToFilterTitle(path)}
    >
      {(fixedExtents.min === null || fixedExtents.max !== null) && (
        <FiltersUI.DatesRange
          extents={fixedExtents}
          onChange={onChange}
          value={fixedValue}
        />
      )}
    </FiltersUI.Container>
  )
}

function KeywordFilterWidget({
  path,
  value,
  onChange,
  onDeactivate,
}: FilterWidgetProps<typeof SearchUIModel.FacetTypes.Keyword>) {
  const facetQ = SearchUIModel.useFacetQuery(path)
  return (
    <FiltersUI.Container
      defaultExpanded
      onDeactivate={onDeactivate}
      title={pathToFilterTitle(path)}
    >
      {GQL.fold(facetQ, {
        fetching: () => null,
        data: (d) => {
          if (d.search.__typename !== 'BoundedSearch') {
            return <div>bad response</div>
          }
          const { facet } = d.search
          if (!facet) {
            return <div>facet not found</div>
          }
          if (facet.__typename !== 'KeywordSearchFacet') {
            return <div>bad facet type</div>
          }
          const availableValues = facet.keywordValues.filter((v) => !value.includes(v))
          return (
            <FiltersUI.List extents={availableValues} onChange={onChange} value={value} />
          )
        },
      })}
    </FiltersUI.Container>
  )
}

function TextFilterWidget({
  path,
  onDeactivate,
  onChange,
  value,
}: FilterWidgetProps<typeof SearchUIModel.FacetTypes.Text>) {
  return (
    <FiltersUI.Container
      defaultExpanded
      onDeactivate={onDeactivate}
      title={pathToFilterTitle(path)}
    >
      <FiltersUI.TextField
        onChange={onChange}
        placeholder="Select enum value(s)"
        value={value || ''}
      />
    </FiltersUI.Container>
  )
}

function BooleanFilterWidget({
  path,
  onDeactivate,
  onChange,
  value,
}: FilterWidgetProps<typeof SearchUIModel.FacetTypes.Boolean>) {
  return (
    <FiltersUI.Container
      defaultExpanded
      onDeactivate={onDeactivate}
      title={pathToFilterTitle(path)}
    >
      <FiltersUI.Checkbox
        onChange={onChange}
        label={`Show ${JSONPointer.stringify(path)}`}
        value={!!value}
      />
    </FiltersUI.Container>
  )
}

const FILTER_WIDGETS = {
  Boolean: BooleanFilterWidget,
  Date: DateFilterWidget,
  Keyword: KeywordFilterWidget,
  Number: NumberFilterWidget,
  Text: TextFilterWidget,
}

function renderFilterWidget<F extends SearchUIModel.KnownFacetDescriptor>(
  facet: F,
  actions: FacetActions<F['type']>,
) {
  // eslint-disable-next-line no-underscore-dangle
  const FilterWidget = FILTER_WIDGETS[facet.type._tag]
  // @ts-expect-error
  return <FilterWidget {...facet.state} {...actions} path={facet.path} />
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

  return renderFilterWidget(facet, actions)
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

const useFiltersStyles = M.makeStyles((t) => ({
  root: {
    alignContent: 'start',
    display: 'grid',
    gridRowGap: t.spacing(1),
    gridTemplateRows: 'auto',
  },
  available: {
    marginTop: t.spacing(2),
    overflow: 'hidden',
  },
}))

function Filters() {
  const classes = useFiltersStyles()
  return (
    <div className={classes.root}>
      <ResultTypeFilterWidget />
      <BucketsFilterWidget />
      <ActiveFacets />
      <AvailableFacets className={classes.available} />
    </div>
  )
}

interface SearchHitProps {
  hit: SearchUIModel.SearchHit
}

function SearchHit({ hit }: SearchHitProps) {
  switch (hit.__typename) {
    case 'SearchHitObject':
      return (
        <SearchResults.Hit
          {...{
            hit: {
              type: 'object',
              bucket: hit.bucket,
              path: hit.key,
              versions: [{ id: hit.version, size: hit.size, updated: hit.lastModified }],
            },
          }}
        />
      )
    case 'SearchHitPackage':
      return (
        <SearchResults.Hit
          {...{
            hit: {
              type: 'package',
              bucket: hit.bucket,
              handle: hit.name,
              hash: hit.hash,
              lastModified: hit.lastModified,
              meta: hit.meta,
              tags: [],
              comment: hit.comment,
            },
          }}
        />
      )
    default:
      throw new Error('Wrong typename')
  }
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
    <div style={{ overflow: 'hidden' }}>
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
    gridColumnGap: t.spacing(2),
    padding: t.spacing(4, 3),
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