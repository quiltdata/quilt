import cx from 'classnames'
import invariant from 'invariant'
import * as React from 'react'
import * as M from '@material-ui/core'

import * as FiltersUI from 'components/Filters'
import Layout from 'components/Layout'
import * as SearchResults from 'components/SearchResults'
import * as GQL from 'utils/GraphQL'
import * as JSONPointer from 'utils/JSONPointer'
import MetaTitle from 'utils/MetaTitle'
import assertNever from 'utils/assertNever'
import * as Format from 'utils/format'

import * as SearchUIModel from './model'
// import AvailableFacets from './AvailableFacets'
import BucketSelector from './Buckets'
import ResultTypeSelector from './ResultType'
import { EmptyResults, ResultsSkeleton } from './Results'
import SortSelector from './Sort'

const useFilterSectionStyles = M.makeStyles((t) => ({
  root: {
    marginBottom: t.spacing(2),
    paddingBottom: t.spacing(1),
    position: 'relative',
    '&:after': {
      background: t.palette.divider,
      border: `1px solid ${t.palette.background.paper}`,
      borderWidth: '1px 0',
      content: '""',
      height: '3px',
      left: '25%',
      position: 'absolute',
      right: '25%',
      bottom: 0,
    },
  },
}))

function FilterSection({
  children,
  className,
}: React.PropsWithChildren<{ className?: string }>) {
  const classes = useFilterSectionStyles()
  return <div className={cx(classes.root, className)}>{children}</div>
}

interface MoreButtonProps {
  className?: string
  onClick: () => void
  reverse?: boolean
}

function MoreButton({ className, onClick, reverse }: MoreButtonProps) {
  return (
    <M.Button
      className={className}
      startIcon={<M.Icon>{reverse ? 'expand_less' : 'expand_more'}</M.Icon>}
      onClick={onClick}
      size="small"
    >
      {reverse ? 'Less filters' : 'More filters'}
    </M.Button>
  )
}

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
  // XXX: query extents
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
  // XXX: query extents
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

function KeywordEnumFilterWidget({
  state,
  extents,
  onChange,
}: FilterWidgetProps<SearchUIModel.Predicates['KeywordEnum']>) {
  // XXX: query extents
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

function KeywordWildcardFilterWidget({
  state,
  onChange,
}: FilterWidgetProps<SearchUIModel.Predicates['KeywordWildcard']>) {
  const handleChange = React.useCallback(
    (wildcard: string) => {
      onChange({ ...state, wildcard })
    },
    [onChange, state],
  )
  // TODO: link to docs:
  // https://www.elastic.co/guide/en/elasticsearch/reference/6.7/query-dsl-wildcard-query.html
  return (
    <FiltersUI.TextField
      onChange={handleChange}
      placeholder="Match against"
      value={state.wildcard}
    />
  )
}

function TextFilterWidget({
  state,
  onChange,
}: FilterWidgetProps<SearchUIModel.Predicates['Text']>) {
  const handleChange = React.useCallback(
    (queryString: string) => {
      onChange({ ...state, queryString })
    },
    [onChange, state],
  )
  // TODO: link to docs:
  // https://www.elastic.co/guide/en/elasticsearch/reference/6.7/query-dsl-simple-query-string-query.html
  return (
    <FiltersUI.TextField
      onChange={handleChange}
      placeholder="Match against"
      value={state.queryString}
    />
  )
}

type BooleanFilterValue = SearchUIModel.Untag<
  SearchUIModel.PredicateState<SearchUIModel.Predicates['Boolean']>
>

function BooleanFilterWidget({
  state,
  onChange,
}: FilterWidgetProps<SearchUIModel.Predicates['Boolean']>) {
  const handleChange = React.useCallback(
    (value: BooleanFilterValue) => {
      onChange({ ...state, ...value })
    },
    [onChange, state],
  )
  return <FiltersUI.BooleanFilter onChange={handleChange} value={state} />
}

const WIDGETS = {
  Datetime: DatetimeFilterWidget,
  Number: NumberFilterWidget,
  Text: TextFilterWidget,
  KeywordEnum: KeywordEnumFilterWidget,
  KeywordWildcard: KeywordWildcardFilterWidget,
  Boolean: BooleanFilterWidget,
}

function FilterWidget(props: FilterWidgetProps) {
  const Widget = WIDGETS[props.state._tag]
  return <Widget {...(props as $TSFixMe)} />
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
  className?: string
  field: Exclude<keyof SearchUIModel.PackagesSearchFilter, 'userMeta'>
}

function PackagesFilter({ className, field }: PackagesFilterProps) {
  const model = SearchUIModel.use()
  invariant(
    model.state.resultType === SearchUIModel.ResultType.QuiltPackage,
    'Filter type mismatch',
  )
  const predicateState = model.state.filter.predicates[field]
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
    error: () => undefined,
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

interface PackagesMetaFilterActivatorProps {
  typename: SearchUIModel.PackageUserMetaFacet['__typename']
  path: SearchUIModel.PackageUserMetaFacet['path']
  label: React.ReactNode
}

function PackagesMetaFilterActivator({
  typename,
  path,
  label,
}: PackagesMetaFilterActivatorProps) {
  const model = SearchUIModel.use()
  invariant(
    model.state.resultType === SearchUIModel.ResultType.QuiltPackage,
    'Filter type mismatch',
  )
  const { activatePackagesMetaFilter } = model.actions
  const type = SearchUIModel.PackageUserMetaFacetMap[typename]
  const activate = React.useCallback(() => {
    activatePackagesMetaFilter(path, type)
  }, [activatePackagesMetaFilter, path, type])
  return <FiltersUI.Activator title={label} onClick={activate} />
}

interface PackageMetaFilterProps {
  className?: string
  path: string
}

function PackagesMetaFilter({ className, path }: PackageMetaFilterProps) {
  const model = SearchUIModel.use()
  invariant(
    model.state.resultType === SearchUIModel.ResultType.QuiltPackage,
    'Filter type mismatch',
  )

  const predicateState = model.state.filter.predicates.userMeta?.children?.get(path)
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

  const title = React.useMemo(() => JSONPointer.parse(path).join(' / '), [path])

  const extents = SearchUIModel.usePackageUserMetaFacetExtents(path)

  return (
    <FiltersUI.Container
      className={className}
      defaultExpanded
      onDeactivate={deactivate}
      title={title}
    >
      <FilterWidget state={predicateState} extents={extents} onChange={change} />
    </FiltersUI.Container>
  )
}

const useFilterGroupStyles = M.makeStyles((t) => ({
  root: {
    background: 'inherit',
  },
  auxList: {
    background: 'inherit',
    listStyle: 'none',
    padding: 0,
  },
  nested: {
    paddingLeft: t.spacing(4),
  },
  toggleIcon: {
    minWidth: t.spacing(5),
  },
}))

interface FilterGroupProps {
  path?: string
  // TODO: in therory, every filter group can have "more" and it's own `expanded` state
  //       though, it requires refactoring
  onMore: () => void
  items: ReturnType<typeof SearchUIModel.groupFacets>['children']
}

function FilterGroup({ path, items, onMore }: FilterGroupProps) {
  const classes = useFilterGroupStyles()

  function getLabel(key: string) {
    const [type, rest] = key.split(':')
    switch (type) {
      case 'path':
        return rest
      case 'type':
        return `Type: ${rest}`
      case 'more':
        return 'More ...'
      default:
        return key
    }
  }

  const [expanded, setExpanded] = React.useState(false)
  if (path === 'more') return <MoreButton onClick={onMore} />

  return (
    <li className={cx(classes.root)}>
      <ul className={classes.auxList}>
        {!!path && (
          <M.ListItem button disableGutters onClick={() => setExpanded(!expanded)}>
            <M.ListItemIcon className={classes.toggleIcon}>
              <M.Icon>{expanded ? 'expand_less' : 'expand_more'}</M.Icon>
            </M.ListItemIcon>
            <M.ListItemText primary={getLabel(path)} />
          </M.ListItem>
        )}
        <div className={cx({ [classes.nested]: !!path })}>
          <M.Collapse in={expanded || !path}>
            {Array.from(items).map(([p, node]) =>
              node._tag === 'Tree' ? (
                <FilterGroup
                  path={p}
                  items={node.children}
                  onMore={onMore}
                  key={path + p}
                />
              ) : (
                <PackagesMetaFilterActivator
                  key={path + p}
                  typename={node.value.__typename}
                  path={node.value.path}
                  label={getLabel(p)}
                />
              ),
            )}
          </M.Collapse>
        </div>
      </ul>
    </li>
  )
}

const FACETS_THRESHOLD = 5

const useAvailablePackagesMetaFiltersStyles = M.makeStyles((t) => ({
  list: {
    background: t.palette.background.default,
  },
  help: {
    ...t.typography.caption,
    marginTop: t.spacing(1),
  },
  input: {
    background: t.palette.background.paper,
    marginBottom: t.spacing(0.5),
  },
}))

interface AvailablePackagesMetaFiltersProps {
  className?: string
  fetching: boolean
  filters: SearchUIModel.PackageUserMetaFacet[]
}

function AvailablePackagesMetaFilters({
  className,
  // fetching,
  filters,
}: AvailablePackagesMetaFiltersProps) {
  const classes = useAvailablePackagesMetaFiltersStyles()
  const [query, setQuery] = React.useState('')
  const filtered = React.useMemo(
    () =>
      filters.length > FACETS_THRESHOLD
        ? filters.filter((f) =>
            (f.path + SearchUIModel.PackageUserMetaFacetMap[f.__typename])
              .toLowerCase()
              .includes(query.toLowerCase()),
          )
        : filters,
    [filters, query],
  )

  const filteredNumber = filtered.length
  const hiddenNumber = filters.length - filteredNumber

  const [visibleCount, setVisibleCount] = React.useState(FACETS_THRESHOLD)
  const grouped = React.useMemo(
    () => SearchUIModel.groupFacets(filtered, visibleCount),
    [filtered, visibleCount],
  )

  // TODO: lock when fetching
  return (
    <div className={className}>
      {filters.length > FACETS_THRESHOLD && (
        <FiltersUI.TinyTextField
          placeholder="Find metadata filter"
          fullWidth
          value={query}
          onChange={setQuery}
          className={classes.input}
        />
      )}
      <M.List dense disablePadding className={classes.list}>
        <FilterGroup items={grouped.children} onMore={() => setVisibleCount(0)} />
      </M.List>
      {!!hiddenNumber && (
        <p className={classes.help}>
          {filteredNumber
            ? `There are ${hiddenNumber} more filters available. Loosen search query to see more.`
            : `${hiddenNumber} filters are hidden. Clear search query to see them.`}
        </p>
      )}
    </div>
  )
}

const usePackagesMetaFiltersStyles = M.makeStyles((t) => ({
  title: {
    ...t.typography.subtitle1,
    fontWeight: 500,
    marginBottom: t.spacing(1),
  },
}))

interface PackagesMetaFiltersProps {
  className: string
}

function PackagesMetaFilters({ className }: PackagesMetaFiltersProps) {
  const classes = usePackagesMetaFiltersStyles()

  const { activatedPaths, available, fetching } = SearchUIModel.usePackagesMetaFilters()

  const noFilters = !(available.length + activatedPaths.length)

  // TODO: progress indication: a spinner next to header?
  return (
    <div className={className}>
      <div className={classes.title}>User metadata</div>
      {activatedPaths.map((path) => (
        <FilterSection key={path}>
          <PackagesMetaFilter path={path} />
        </FilterSection>
      ))}
      {!!available.length && (
        <AvailablePackagesMetaFilters filters={available} fetching={fetching} />
      )}
      {noFilters && (
        // XXX: nicer display
        <M.Typography>No metadata found</M.Typography>
      )}
    </div>
  )
}

const packagesFiltersPrimary = ['workflow', 'modified'] as const

const packagesFiltersSecondary = ['size', 'name', 'hash', 'entries', 'comment'] as const

const usePackageFiltersStyles = M.makeStyles((t) => ({
  metadata: {
    marginTop: t.spacing(3),
  },
  title: {
    ...t.typography.subtitle1,
    fontWeight: 500,
    marginBottom: t.spacing(1),
  },
  more: {
    marginTop: t.spacing(0.5),
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

  const { order: activeFilters, predicates } = model.state.filter

  const availableFilters = packagesFiltersPrimary.filter((f) => !predicates[f])
  const moreFilters = packagesFiltersSecondary.filter((f) => !predicates[f])

  const [expanded, setExpanded] = React.useState(false)
  const toggleExpanded = React.useCallback(() => setExpanded((x) => !x), [])

  return (
    <div className={className}>
      <div className={classes.title}>System metadata</div>

      {activeFilters.map(
        (f) =>
          f !== 'userMeta' && (
            <FilterSection key={f}>
              <PackagesFilter field={f} />
            </FilterSection>
          ),
      )}

      {!!availableFilters.length && (
        <M.List dense disablePadding>
          {availableFilters.map((f) => (
            <PackagesFilterActivator key={f} field={f} />
          ))}
        </M.List>
      )}

      {!!moreFilters.length && (
        <>
          <M.Collapse in={expanded}>
            <M.List dense disablePadding>
              {moreFilters.map((f) => (
                <PackagesFilterActivator key={f} field={f} />
              ))}
            </M.List>
          </M.Collapse>
          <MoreButton
            className={classes.more}
            onClick={toggleExpanded}
            reverse={expanded}
          />
        </>
      )}

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
  className?: string
  field: keyof SearchUIModel.ObjectsSearchFilter
}

function ObjectsFilter({ className, field }: ObjectsFilterProps) {
  const model = SearchUIModel.use()
  invariant(
    model.state.resultType === SearchUIModel.ResultType.S3Object,
    'Filter type mismatch',
  )
  const predicateState = model.state.filter.predicates[field]
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
    error: () => undefined,
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

const useObjectFiltersStyles = M.makeStyles((t) => ({
  more: {
    marginTop: t.spacing(0.5),
  },
  title: {
    ...t.typography.subtitle1,
    fontWeight: 500,
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

  const { order: activeFilters, predicates } = model.state.filter

  const availableFilters = objectsFiltersPrimary.filter((f) => !predicates[f])
  const moreFilters = objectsFiltersSecondary.filter((f) => !predicates[f])

  const [expanded, setExpanded] = React.useState(false)
  const toggleExpanded = React.useCallback(() => setExpanded((x) => !x), [])

  return (
    <div className={className}>
      <div className={classes.title}>System metadata</div>

      {activeFilters.map((f) => (
        <FilterSection key={f}>
          <ObjectsFilter field={f} />
        </FilterSection>
      ))}

      {!!availableFilters.length && (
        <M.List dense disablePadding>
          {availableFilters.map((f) => (
            <ObjectsFilterActivator key={f} field={f} />
          ))}
        </M.List>
      )}

      {!!moreFilters.length && (
        <>
          <M.Collapse in={expanded}>
            <M.List dense disablePadding>
              {moreFilters.map((f) => (
                <ObjectsFilterActivator key={f} field={f} />
              ))}
            </M.List>
          </M.Collapse>
          <MoreButton
            className={classes.more}
            onClick={toggleExpanded}
            reverse={expanded}
          />
        </>
      )}
    </div>
  )
}

const useFiltersStyles = M.makeStyles((t) => ({
  root: {
    alignContent: 'start',
    display: 'grid',
    gridRowGap: t.spacing(2),
    gridTemplateRows: 'auto',
    // TODO: Make scroll for sidebar
    // TODO: Also, consider that buckets filter disappears
    // overflow: 'hidden auto',
    // padding: t.spacing(0.5, 0, 0),
    // height: `calc(100vh - ${t.spacing(4 + 8)}px)` // -padding -header
  },
  title: {
    ...t.typography.h6,
    marginBottom: t.spacing(0.5),
  },
  variable: {
    marginTop: t.spacing(1),
    overflow: 'hidden auto',
  },
}))

function Filters() {
  const classes = useFiltersStyles()
  const model = SearchUIModel.use()
  return (
    <div className={classes.root}>
      <div className={classes.title}>Filter by</div>
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
  className?: string
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
            return (
              <EmptyResults
                className={className}
                description={r.error.message}
                image="error"
                title="GQL error"
              />
            )
          case 'data':
            switch (r.data.__typename) {
              case 'InvalidInput':
                // should not happen
                return (
                  <EmptyResults
                    className={className}
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

interface ResultsInnerProps {
  className?: string
}

function ResultsInner({ className }: ResultsInnerProps) {
  const model = SearchUIModel.use()
  const r = model.firstPageQuery

  switch (r._tag) {
    case 'fetching':
      return <ResultsSkeleton className={className} />
    case 'error':
      return (
        <EmptyResults
          className={className}
          description={r.error.message}
          image="error"
          title="GraphQL Error"
        />
      )
    case 'data':
      switch (r.data.__typename) {
        case 'EmptySearchResultSet':
          return <EmptyResults className={className} />
        case 'InvalidInput':
          return (
            <EmptyResults
              className={className}
              description={r.data.errors[0].message}
              image="error"
              title="Invalid input"
            />
          )
        case 'ObjectsSearchResultSet':
        case 'PackagesSearchResultSet':
          return (
            <ResultsPage
              className={className}
              key={`${model.state.resultType}:${r.data.firstPage.cursor}`}
              resultType={model.state.resultType}
              hits={r.data.firstPage.hits}
              cursor={r.data.firstPage.cursor}
            />
          )
        default:
          assertNever(r.data)
      }
    default:
      assertNever(r)
  }
}

function ResultsCount() {
  const r = SearchUIModel.use().firstPageQuery
  switch (r._tag) {
    case 'fetching':
      return <M.CircularProgress size={24} />
    case 'error':
      return null
    case 'data':
      switch (r.data.__typename) {
        case 'EmptySearchResultSet':
        case 'InvalidInput':
          return null
        case 'ObjectsSearchResultSet':
        case 'PackagesSearchResultSet':
          return (
            <M.Typography variant="h6">
              <Format.Plural
                value={r.data.stats.total}
                one="1 result"
                other={(n) => `${n > 0 ? n : 'Search'} results`}
              />
            </M.Typography>
          )
        default:
          assertNever(r.data)
      }
    default:
      assertNever(r)
  }
}

const useResultsStyles = M.makeStyles((t) => ({
  root: {
    overflow: 'hidden',
  },
  toolbar: {
    alignItems: 'center',
    display: 'flex',
    minHeight: '36px',
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
  return (
    <div className={classes.root}>
      <div className={classes.toolbar}>
        <ResultsCount />
        <SortSelector className={classes.sort} />
      </div>
      <ResultsInner className={classes.results} />
    </div>
  )
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
    <M.Container maxWidth="lg" className={classes.root}>
      <MetaTitle>{model.state.searchString || 'Search'}</MetaTitle>
      <Filters />
      <Results />
    </M.Container>
  )
}

export default function Search() {
  return (
    <SearchUIModel.Provider>
      <Layout pre={<SearchLayout />} />
    </SearchUIModel.Provider>
  )
}
