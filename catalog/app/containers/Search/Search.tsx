import cx from 'classnames'
import invariant from 'invariant'
import * as React from 'react'
import * as M from '@material-ui/core'

import * as FiltersUI from 'components/Filters'
import Layout from 'components/Layout'
import * as SearchResults from 'components/SearchResults'
import * as GQL from 'utils/GraphQL'
import MetaTitle from 'utils/MetaTitle'
import assertNever from 'utils/assertNever'
import * as Format from 'utils/format'
// import * as JSONPointer from 'utils/JSONPointer'

import * as SearchUIModel from './model'
// import AvailableFacets from './AvailableFacets'
import BucketSelector from './Buckets'
import ResultTypeSelector from './ResultType'
import { EmptyResults, ResultsSkeleton } from './Results'
import SortSelector from './Sort'

// const isNumber = (v: unknown): v is number => typeof v === 'number' && !Number.isNaN(v)

interface FilterWidgetProps<
  P extends SearchUIModel.PrimitivePredicate = SearchUIModel.PrimitivePredicate,
> {
  state: SearchUIModel.PredicateState<P>
  extents?: SearchUIModel.ExtentsForPredicate<P>
  onChange: (state: SearchUIModel.PredicateState<P>) => void
}

function NumberFilterWidget({
  state,
  extents,
  onChange,
}: FilterWidgetProps<SearchUIModel.Predicates['Number']>) {
  // const unit = React.useMemo(() => {
  //   switch (JSONPointer.stringify(path)) {
  //     case '/pkg/total_entries':
  //       return 'Entries'
  //     case '/pkg/total_size':
  //       return 'Bytes'
  //     // no-default
  //   }
  // }, [path])
  // const hasExtents = isNumber(extents.min) && isNumber(extents.max)
  // const hasSingleExtent = extents.min === extents.max
  const handleChange = React.useCallback(
    (value: { min: number | null; max: number | null }) => {
      onChange({ ...state, gte: value.min, lte: value.max })
    },
    [onChange, state],
  )
  // XXX
  const extentsComputed = React.useMemo(
    () => ({
      min: extents?.min ?? state.gte ?? 0,
      max: extents?.max ?? state.lte ?? 0,
    }),
    [extents?.min, extents?.max, state.gte, state.lte],
  )

  return (
    // {hasExtents &&
    //   (hasSingleExtent ? (
    //     <FiltersUI.Checkbox
    //       label={`${extents.min} ${unit || ''}`}
    //       onChange={(checked) =>
    //         checked
    //           ? onChange({ min: extents.min, max: extents.max })
    //           : onChange({ min: null, max: null })
    //       }
    //       value={value.min === extents.min && value.max === extents.max}
    //     />
    //   ) : (
    <FiltersUI.NumbersRange
      extents={extentsComputed}
      onChange={handleChange}
      // unit={unit}
      value={{ min: state.gte, max: state.lte }}
    />
  )
}

function DatetimeFilterWidget({
  state,
  extents,
  onChange,
}: FilterWidgetProps<SearchUIModel.Predicates['Datetime']>) {
  const fixedExtents = React.useMemo(
    () => ({
      min: extents?.min ?? new Date(),
      max: extents?.max ?? new Date(),
    }),
    [extents?.min, extents?.max],
  )

  const fixedValue = React.useMemo(
    () => ({ min: state.gte, max: state.lte }),
    [state.gte, state.lte],
  )

  const handleChange = React.useCallback(
    (v: { min: Date | null; max: Date | null }) => {
      onChange({ ...state, gte: v.min, lte: v.max })
    },
    [onChange, state],
  )

  return (
    <FiltersUI.DatesRange
      extents={fixedExtents}
      onChange={handleChange}
      value={fixedValue}
    />
  )
}

const EMPTY_TERMS: string[] = []

function KeywordFilterWidget({
  state,
  extents,
  onChange,
}: FilterWidgetProps<SearchUIModel.Predicates['Keyword']>) {
  const handleChange = React.useCallback(
    (value: string[]) => {
      onChange({ ...state, terms: value })
    },
    [onChange, state],
  )
  const availableValues = extents?.values ?? EMPTY_TERMS

  return (
    <FiltersUI.List
      extents={availableValues}
      onChange={handleChange}
      value={state.terms}
    />
  )
}

function TextFilterWidget({
  state,
  onChange,
}: FilterWidgetProps<SearchUIModel.Predicates['Text']>) {
  const handleChange = React.useCallback(
    (match: string) => {
      onChange({ ...state, match })
    },
    [onChange, state],
  )
  return (
    <FiltersUI.TextField
      onChange={handleChange}
      placeholder="Match against"
      value={state.match}
    />
  )
}

function BooleanFilterWidget({
  state,
  onChange,
}: FilterWidgetProps<SearchUIModel.Predicates['Boolean']>) {
  const handleChange = React.useCallback(
    (value: boolean) => {
      onChange({ ...state, value })
    },
    [onChange, state],
  )
  return (
    <FiltersUI.Checkbox
      onChange={handleChange}
      label="LABEL TBD"
      // label={`Show ${JSONPointer.stringify(path)}`}
      value={!!state.value}
    />
  )
}

function FilterWidget(props: FilterWidgetProps) {
  // eslint-disable-next-line no-underscore-dangle
  switch (props.state._tag) {
    case 'Datetime':
      return <DatetimeFilterWidget {...(props as $TSFixMe)} />
    case 'Number':
      return <NumberFilterWidget {...(props as $TSFixMe)} />
    case 'Text':
      return <TextFilterWidget {...(props as $TSFixMe)} />
    case 'Keyword':
      return <KeywordFilterWidget {...(props as $TSFixMe)} />
    case 'Boolean':
      return <BooleanFilterWidget {...(props as $TSFixMe)} />
    default:
      assertNever(props.state)
  }
}

const packageFilterLabels = {
  modified: 'Last modified',
  size: 'Cumulative package size',
  name: 'Package name',
  hash: 'Package hash',
  entries: 'Total number of entries',
  comment: 'Package revision comment',
  workflow: 'Workflow',
  userMeta: 'User metadata',
}

interface PackagesFilterActivatorProps {
  field: keyof SearchUIModel.PackagesSearchFilter
}

function PackagesFilterActivator({ field }: PackagesFilterActivatorProps) {
  const model = SearchUIModel.use()
  invariant(
    model.state.resultType === SearchUIModel.ResultType.QuiltPackage,
    'Filter type mismatch',
  )
  const { activatePackagesFilter } = model.actions
  const activate = React.useCallback(() => {
    activatePackagesFilter(field)
  }, [activatePackagesFilter, field])
  return <FiltersUI.Activator title={packageFilterLabels[field]} onClick={activate} />
}

interface PackagesFilterProps {
  className: string
  // field: Omit<keyof SearchUIModel.PackagesSearchFilter, 'userMeta'>
  field: 'workflow' | 'modified' | 'size' | 'name' | 'hash' | 'entries' | 'comment'
}

function PackagesFilter({ className, field }: PackagesFilterProps) {
  const model = SearchUIModel.use()
  invariant(
    model.state.resultType === SearchUIModel.ResultType.QuiltPackage,
    'Filter type mismatch',
  )
  const predicateState = model.state.filter[field]
  invariant(predicateState, 'Filter not active')

  const extents = GQL.fold(model.baseSearchQuery, {
    data: ({ searchPackages: r }) => {
      switch (r.__typename) {
        case 'EmptySearchResultSet':
          return undefined
        case 'InvalidInput':
          return undefined
        case 'PackagesSearchResultSet':
          if (
            field === 'workflow' ||
            field === 'modified' ||
            field === 'size' ||
            field === 'entries'
          ) {
            return r.stats[field]
          }
          return undefined
        default:
          assertNever(r)
      }
    },
    fetching: () => undefined,
    error: (e) => {
      // eslint-disable-next-line no-console
      console.error(e)
      return undefined
    },
  })

  const { deactivatePackagesFilter, setPackagesFilter } = model.actions

  const deactivate = React.useCallback(() => {
    deactivatePackagesFilter(field)
  }, [deactivatePackagesFilter, field])

  const change = React.useCallback(
    (state: $TSFixMe) => {
      setPackagesFilter(field, state)
    },
    [setPackagesFilter, field],
  )

  return (
    <FiltersUI.Container
      className={className}
      defaultExpanded
      onDeactivate={deactivate}
      title={packageFilterLabels[field]}
    >
      <FilterWidget state={predicateState} extents={extents} onChange={change} />
    </FiltersUI.Container>
  )
}

function getFacetLabel(facet: SearchUIModel.PackageUserMetaFacet) {
  // XXX
  return (
    <>
      {facet.path} ({PackageUserMetaFacetMap[facet.__typename]})
    </>
  )
}

interface PackagesMetaFilterActivatorProps {
  facet: SearchUIModel.PackageUserMetaFacet
}

const PackageUserMetaFacetMap = {
  NumberPackageUserMetaFacet: 'Number' as const,
  DatetimePackageUserMetaFacet: 'Datetime' as const,
  KeywordPackageUserMetaFacet: 'Keyword' as const,
  TextPackageUserMetaFacet: 'Text' as const,
  BooleanPackageUserMetaFacet: 'Boolean' as const,
}

function PackagesMetaFilterActivator({ facet }: PackagesMetaFilterActivatorProps) {
  const model = SearchUIModel.use()
  invariant(
    model.state.resultType === SearchUIModel.ResultType.QuiltPackage,
    'Filter type mismatch',
  )
  const { activatePackagesMetaFilter } = model.actions
  const type = PackageUserMetaFacetMap[facet.__typename]
  const activate = React.useCallback(() => {
    // XXX: accept the whole facet object?
    activatePackagesMetaFilter(facet.path, type)
  }, [activatePackagesMetaFilter, facet.path, type])
  return <FiltersUI.Activator title={getFacetLabel(facet)} onClick={activate} />
}

function getPackageUserMetaFacetExtents(
  facet?: SearchUIModel.PackageUserMetaFacet,
): SearchUIModel.Extents | undefined {
  switch (facet?.__typename) {
    case 'NumberPackageUserMetaFacet':
      return facet.numberExtents
    case 'DatetimePackageUserMetaFacet':
      return facet.datetimeExtents
    case 'KeywordPackageUserMetaFacet':
      return facet.extents
    default:
      return
  }
}

interface PackageMetaFilterProps {
  className: string
  path: string
  facet?: SearchUIModel.PackageUserMetaFacet
}

function PackagesMetaFilter({ className, path, facet }: PackageMetaFilterProps) {
  const model = SearchUIModel.use()
  invariant(
    model.state.resultType === SearchUIModel.ResultType.QuiltPackage,
    'Filter type mismatch',
  )

  const predicateState = (model.state.filter.userMeta?.children ?? {})[path]
  invariant(predicateState, 'Filter not active')

  const { deactivatePackagesMetaFilter, setPackagesMetaFilter } = model.actions

  const deactivate = React.useCallback(() => {
    deactivatePackagesMetaFilter(path)
  }, [deactivatePackagesMetaFilter, path])

  const change = React.useCallback(
    (state: SearchUIModel.PredicateState<SearchUIModel.PrimitivePredicate>) => {
      setPackagesMetaFilter(path, state)
    },
    [setPackagesMetaFilter, path],
  )

  // TODO: const title = getFacetLabel(path)

  const extents = getPackageUserMetaFacetExtents(facet)

  return (
    <FiltersUI.Container
      className={className}
      defaultExpanded
      onDeactivate={deactivate}
      title={path}
    >
      <FilterWidget state={predicateState} extents={extents} onChange={change} />
    </FiltersUI.Container>
  )
}

const usePackagesMetaFiltersStyles = M.makeStyles((t) => ({
  filter: {
    '& + &': {
      position: 'relative',
      marginTop: t.spacing(1),
      paddingTop: t.spacing(2),
    },
    '& + &:before': {
      background: t.palette.divider,
      border: `1px solid ${t.palette.background.paper}`,
      borderWidth: '1px 0',
      content: '""',
      height: '3px',
      left: t.spacing(2),
      position: 'absolute',
      right: t.spacing(2),
      top: 0,
    },
  },
  title: {
    marginBottom: t.spacing(1),
  },
}))

interface PackagesMetaFiltersProps {
  className: string
}

function PackagesMetaFilters({ className }: PackagesMetaFiltersProps) {
  const model = SearchUIModel.use()
  const classes = usePackagesMetaFiltersStyles()
  invariant(
    model.state.resultType === SearchUIModel.ResultType.QuiltPackage,
    'Filter type mismatch',
  )

  const activated = model.state.filter.userMeta?.children

  const facets = GQL.fold(model.baseSearchQuery, {
    data: ({ searchPackages: r }) => {
      switch (r.__typename) {
        case 'EmptySearchResultSet':
          return []
        case 'InvalidInput':
          return []
        case 'PackagesSearchResultSet':
          return r.stats.userMeta
        default:
          assertNever(r)
      }
    },
    fetching: () => [],
    error: (e) => {
      // eslint-disable-next-line no-console
      console.error(e)
      return []
    },
  })

  const available = React.useMemo(
    () => facets.filter((f) => !activated || !activated[f.path]),
    [facets, activated],
  )

  // workflow: WorkflowSearchPredicate
  // userMeta: [PackageUserMetaPredicate!]
  /*
  workflow filter
  active metadata filters
  available metadata filters
    visible
    more
  */
  if (!available.length && !Object.keys(activated || {}).length) return null
  return (
    <div className={className}>
      <M.Typography variant="h6" className={classes.title}>
        Metadata
      </M.Typography>
      {Object.entries(activated || {}).map(([path, filter]) => {
        const facet = facets.find(
          (f) => f.path === path && filter._tag === PackageUserMetaFacetMap[f.__typename],
        )
        return (
          <PackagesMetaFilter
            className={classes.filter}
            key={path}
            path={path}
            facet={facet}
          />
        )
      })}
      {!!available.length && (
        <M.List dense disablePadding>
          {available.map((f) => (
            <PackagesMetaFilterActivator key={`${f.path}:${f.__typename}`} facet={f} />
          ))}
        </M.List>
      )}
    </div>
  )
}

const packagesFiltersPrimary = ['workflow', 'modified'] as const

const packagesFiltersSecondary = ['size', 'name', 'hash', 'entries', 'comment'] as const

const packagesFilters = [...packagesFiltersPrimary, ...packagesFiltersSecondary] as const

const usePackageFiltersStyles = M.makeStyles((t) => ({
  filter: {
    '& + &': {
      position: 'relative',
      marginTop: t.spacing(1),
      paddingTop: t.spacing(2),
    },
    '& + &:before': {
      background: t.palette.divider,
      border: `1px solid ${t.palette.background.paper}`,
      borderWidth: '1px 0',
      content: '""',
      height: '3px',
      left: t.spacing(2),
      position: 'absolute',
      right: t.spacing(2),
      top: 0,
    },
  },
  metadata: {
    marginTop: t.spacing(2),
  },
  more: {
    marginTop: t.spacing(1),
  },
  title: {
    marginBottom: t.spacing(1),
  },
}))

interface PackageFiltersProps {
  className: string
}

function PackageFilters({ className }: PackageFiltersProps) {
  const model = SearchUIModel.use()
  const classes = usePackageFiltersStyles()

  invariant(
    model.state.resultType === SearchUIModel.ResultType.QuiltPackage,
    'wrong result type',
  )

  const { filter } = model.state

  // TODO: custom order (order of activation):
  //       probably need to remember that, maybe in local state
  const activeFilters = packagesFilters.filter((f) => filter[f])

  const availableFilters = packagesFiltersPrimary.filter((f) => !filter[f])
  const moreFilters = packagesFiltersSecondary.filter((f) => !filter[f])

  const [expanded, setExpanded] = React.useState(false)

  return (
    <div className={className}>
      <M.Typography variant="h6" className={classes.title}>
        Filter by
      </M.Typography>

      {activeFilters.map((f) => (
        <PackagesFilter className={classes.filter} key={f} field={f} />
      ))}

      {!!availableFilters.length && (
        <M.List dense disablePadding>
          {availableFilters.map((f) => (
            <PackagesFilterActivator key={f} field={f} />
          ))}
        </M.List>
      )}

      {!!moreFilters.length &&
        (expanded ? (
          <M.List dense disablePadding>
            {moreFilters.map((f) => (
              <PackagesFilterActivator key={f} field={f} />
            ))}
          </M.List>
        ) : (
          <M.Button
            className={classes.more}
            endIcon={<M.Icon>expand_more</M.Icon>}
            onClick={() => setExpanded(true)}
            size="small"
            variant="outlined"
          >
            More filters
          </M.Button>
        ))}

      <PackagesMetaFilters className={classes.metadata} />
    </div>
  )
}

const objectFilterLabels = {
  modified: 'Last modified',
  size: 'Object size',
  ext: 'Extension',
  key: 'Object key',
  content: 'Contents',
  deleted: 'Delete marker',
}

interface ObjectsFilterActivatorProps {
  field: keyof SearchUIModel.ObjectsSearchFilter
}

function ObjectsFilterActivator({ field }: ObjectsFilterActivatorProps) {
  const model = SearchUIModel.use()
  invariant(
    model.state.resultType === SearchUIModel.ResultType.S3Object,
    'Filter type mismatch',
  )
  const { activateObjectsFilter } = model.actions
  const activate = React.useCallback(() => {
    activateObjectsFilter(field)
  }, [activateObjectsFilter, field])
  return <FiltersUI.Activator title={objectFilterLabels[field]} onClick={activate} />
}

interface ObjectsFilterProps {
  className: string
  field: keyof SearchUIModel.ObjectsSearchFilter
}

function ObjectsFilter({ className, field }: ObjectsFilterProps) {
  const model = SearchUIModel.use()
  invariant(
    model.state.resultType === SearchUIModel.ResultType.S3Object,
    'Filter type mismatch',
  )
  const predicateState = model.state.filter[field]
  invariant(predicateState, 'Filter not active')

  const extents = GQL.fold(model.baseSearchQuery, {
    data: ({ searchObjects: r }) => {
      switch (r.__typename) {
        case 'EmptySearchResultSet':
          return undefined
        case 'InvalidInput':
          return undefined
        case 'ObjectsSearchResultSet':
          if (field === 'modified' || field === 'size' || field === 'ext') {
            return r.stats[field]
          }
          return undefined
        default:
          assertNever(r)
      }
    },
    fetching: () => undefined,
    error: (e) => {
      // eslint-disable-next-line no-console
      console.error(e)
      return undefined
    },
  })

  const { deactivateObjectsFilter, setObjectsFilter } = model.actions

  const deactivate = React.useCallback(() => {
    deactivateObjectsFilter(field)
  }, [deactivateObjectsFilter, field])

  const change = React.useCallback(
    (state: $TSFixMe) => {
      setObjectsFilter(field, state)
    },
    [setObjectsFilter, field],
  )

  return (
    <FiltersUI.Container
      className={className}
      defaultExpanded
      onDeactivate={deactivate}
      title={objectFilterLabels[field]}
    >
      <FilterWidget state={predicateState} extents={extents} onChange={change} />
    </FiltersUI.Container>
  )
}

const objectsFiltersPrimary = ['modified', 'ext'] as const

const objectsFiltersSecondary = ['size', 'key', 'content', 'deleted'] as const

const objectsFilters = [...objectsFiltersPrimary, ...objectsFiltersSecondary] as const

const useObjectFiltersStyles = M.makeStyles((t) => ({
  filter: {
    '& + &': {
      position: 'relative',
      marginTop: t.spacing(1),
      paddingTop: t.spacing(2),
    },
    '& + &:before': {
      background: t.palette.divider,
      border: `1px solid ${t.palette.background.paper}`,
      borderWidth: '1px 0',
      content: '""',
      height: '3px',
      left: t.spacing(2),
      position: 'absolute',
      right: t.spacing(2),
      top: 0,
    },
  },
  more: {
    marginTop: t.spacing(1),
  },
  title: {
    marginBottom: t.spacing(1),
  },
}))

interface ObjectFiltersProps {
  className: string
}

function ObjectFilters({ className }: ObjectFiltersProps) {
  const model = SearchUIModel.use()
  const classes = useObjectFiltersStyles()

  invariant(
    model.state.resultType === SearchUIModel.ResultType.S3Object,
    'wrong result type',
  )

  const { filter } = model.state

  // TODO: custom order (order of activation):
  //       probably need to remember that, maybe in local state
  const activeFilters = objectsFilters.filter((f) => filter[f])

  const availableFilters = objectsFiltersPrimary.filter((f) => !filter[f])
  const moreFilters = objectsFiltersSecondary.filter((f) => !filter[f])

  const [expanded, setExpanded] = React.useState(false)

  return (
    <div className={className}>
      <M.Typography variant="h6" className={classes.title}>
        Filter by
      </M.Typography>

      {activeFilters.map((f) => (
        <ObjectsFilter className={classes.filter} key={f} field={f} />
      ))}

      {!!availableFilters.length && (
        <M.List dense disablePadding>
          {availableFilters.map((f) => (
            <ObjectsFilterActivator key={f} field={f} />
          ))}
        </M.List>
      )}

      {!!moreFilters.length &&
        (expanded ? (
          <M.List dense disablePadding>
            {moreFilters.map((f) => (
              <ObjectsFilterActivator key={f} field={f} />
            ))}
          </M.List>
        ) : (
          <M.Button
            className={classes.more}
            endIcon={<M.Icon>expand_more</M.Icon>}
            onClick={() => setExpanded(true)}
            size="small"
            variant="outlined"
          >
            More filters
          </M.Button>
        ))}
    </div>
  )
}

const useFiltersStyles = M.makeStyles((t) => ({
  root: {
    alignContent: 'start',
    display: 'grid',
    gridRowGap: t.spacing(2),
    gridTemplateRows: 'auto',
  },
  variable: {
    marginTop: t.spacing(1),
  },
}))

function Filters() {
  const classes = useFiltersStyles()
  const model = SearchUIModel.use()
  return (
    <div className={classes.root}>
      <ResultTypeSelector />
      <BucketSelector />
      {model.state.resultType === SearchUIModel.ResultType.QuiltPackage ? (
        <PackageFilters className={classes.variable} />
      ) : (
        <ObjectFilters className={classes.variable} />
      )}
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
          showBucket
          hit={{
            type: 'object',
            bucket: hit.bucket,
            path: hit.key,
            versions: [{ id: hit.version, size: hit.size, updated: hit.modified }],
          }}
        />
      )
    case 'SearchHitPackage':
      return (
        <SearchResults.Hit
          showBucket
          hit={{
            type: 'package',
            bucket: hit.bucket,
            handle: hit.name,
            hash: hit.hash,
            lastModified: hit.modified,
            meta: hit.meta,
            tags: [],
            comment: hit.comment,
          }}
        />
      )
    default:
      assertNever(hit)
  }
}

const useLoadNextPageStyles = M.makeStyles((t) => ({
  root: {
    padding: t.spacing(1, 0),
    display: 'flex',
    justifyContent: 'flex-end',
  },
}))

interface LoadNextPageProps {
  className: string
  loading?: boolean
  onClick?: () => void
}

function LoadNextPage({ className, loading = false, onClick }: LoadNextPageProps) {
  const classes = useLoadNextPageStyles()
  return (
    <div className={cx(classes.root, className)}>
      <M.Button
        endIcon={
          loading ? <M.CircularProgress size={16} /> : <M.Icon>expand_more</M.Icon>
        }
        onClick={onClick}
        variant="outlined"
        disabled={loading}
      >
        Load more
      </M.Button>
    </div>
  )
}

const useResultsPageStyles = M.makeStyles((t) => ({
  next: {
    marginTop: t.spacing(1),
  },
}))

interface ResultsPageProps {
  className: string
  cursor: string | null
  hits: readonly SearchUIModel.SearchHit[]
  resultType: SearchUIModel.ResultType
}

function ResultsPage({ className, hits, cursor, resultType }: ResultsPageProps) {
  const classes = useResultsPageStyles()
  const [more, setMore] = React.useState(false)
  const loadMore = React.useCallback(() => {
    setMore(true)
  }, [])
  return (
    <div className={className}>
      {hits.map((hit) => (
        <SearchHit key={hit.id} hit={hit} />
      ))}
      {!!cursor &&
        (more ? (
          <NextPage after={cursor} className={classes.next} resultType={resultType} />
        ) : (
          <LoadNextPage className={classes.next} onClick={loadMore} />
        ))}
    </div>
  )
}

type NextPageQueryResult =
  | ReturnType<typeof SearchUIModel.useNextPagePackagesQuery>
  | ReturnType<typeof SearchUIModel.useNextPageObjectsQuery>

interface NextPageQueryProps {
  after: string
  children: (result: NextPageQueryResult) => React.ReactElement
}

function NextPageObjectsQuery({ after, children }: NextPageQueryProps) {
  return children(SearchUIModel.useNextPageObjectsQuery(after))
}

function NextPagePackagesQuery({ after, children }: NextPageQueryProps) {
  return children(SearchUIModel.useNextPagePackagesQuery(after))
}

interface NextPageProps {
  after: string
  resultType: SearchUIModel.ResultType
  className: string
}

function NextPage({ after, className, resultType }: NextPageProps) {
  const NextPageQuery =
    resultType === SearchUIModel.ResultType.S3Object
      ? NextPageObjectsQuery
      : NextPagePackagesQuery
  return (
    <NextPageQuery after={after}>
      {(r) => {
        switch (r._tag) {
          case 'fetching':
            return <LoadNextPage className={className} loading />
          case 'error':
            // eslint-disable-next-line no-console
            console.error(r.error)
            return <p className={className}>gql error: {r.error.message}</p>
          case 'data':
            switch (r.data.__typename) {
              case 'InvalidInput':
                // should not happen
                return (
                  <EmptyResults
                    description={r.data.errors[0].message}
                    image="error"
                    title="Invalid input"
                  />
                )
              case 'PackagesSearchResultSetPage':
              case 'ObjectsSearchResultSetPage':
                return (
                  <ResultsPage
                    className={className}
                    hits={r.data.hits}
                    cursor={r.data.cursor}
                    resultType={resultType}
                  />
                )
              default:
                assertNever(r.data)
            }
          default:
            assertNever(r)
        }
      }}
    </NextPageQuery>
  )
}

const { addTag } = SearchUIModel

const useResultsStyles = M.makeStyles((t) => ({
  root: {
    overflow: 'hidden',
  },
  toolbar: {
    alignItems: 'center',
    display: 'flex',
  },
  sort: {
    marginLeft: 'auto',
  },
  results: {
    marginTop: t.spacing(2),
  },
}))

function Results() {
  const classes = useResultsStyles()
  const model = SearchUIModel.use()

  const className = 'TBD'

  function fold() {
    switch (model.state.resultType) {
      case SearchUIModel.ResultType.S3Object:
        return GQL.fold(model.firstPageObjectsQuery, {
          data: ({ searchObjects: data }) => addTag('data', { data }),
          fetching: () => addTag('fetching', {}),
          error: (error) => addTag('error', { error }),
        })
      case SearchUIModel.ResultType.QuiltPackage:
        return GQL.fold(model.firstPagePackagesQuery, {
          data: ({ searchPackages: data }) => addTag('data', { data }),
          fetching: () => addTag('fetching', {}),
          error: (error) => addTag('error', { error }),
        })
      default:
        assertNever(model.state)
    }
  }

  const r = fold()

  // eslint-disable-next-line no-underscore-dangle
  switch (r._tag) {
    case 'fetching':
      return <ResultsSkeleton className={className} />
    case 'error':
      // eslint-disable-next-line no-console
      console.error(r.error)
      return <p className={className}>gql error: {r.error.message}</p>
    case 'data':
      switch (r.data.__typename) {
        case 'EmptySearchResultSet':
          return <EmptyResults />
        case 'InvalidInput':
          return (
            <EmptyResults
              description={r.data.errors[0].message}
              image="error"
              title="Invalid input"
            />
          )
        case 'ObjectsSearchResultSet':
        case 'PackagesSearchResultSet':
          return (
            <div className={classes.root}>
              <div className={classes.toolbar}>
                <M.Typography variant="h6">
                  <Format.Plural
                    value={r.data.stats.total}
                    one="1 result"
                    other={(n) => `${n} results`}
                  />
                </M.Typography>
                <SortSelector className={classes.sort} />
              </div>
              <ResultsPage
                className={className}
                resultType={model.state.resultType}
                hits={r.data.firstPage.hits}
                cursor={r.data.firstPage.cursor}
              />
            </div>
          )
        default:
          assertNever(r.data)
      }
    default:
      assertNever(r)
  }
}

const useStyles = M.makeStyles((t) => ({
  root: {
    alignItems: 'start',
    display: 'grid',
    gridColumnGap: t.spacing(2),
    gridTemplateColumns: `${t.spacing(40)}px auto`,
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
