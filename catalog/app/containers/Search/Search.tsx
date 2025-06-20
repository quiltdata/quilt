import cx from 'classnames'
import invariant from 'invariant'
import * as React from 'react'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import * as FiltersUI from 'components/Filters'
import Layout from 'components/Layout'
import Skeleton from 'components/Skeleton'
import * as GQL from 'utils/GraphQL'
import * as JSONPointer from 'utils/JSONPointer'
import MetaTitle from 'utils/MetaTitle'
import assertNever from 'utils/assertNever'
import * as Format from 'utils/format'

import * as SearchUIModel from './model'
import AssistantContext from './AssistantContext'
import BucketSelector from './Buckets'
import FilterWidget from './FilterWidget'
import ResultTypeSelector from './ResultType'
import SortSelector from './Sort'
import * as Views from './Views'
import { PACKAGES_FILTERS_PRIMARY, PACKAGES_FILTERS_SECONDARY } from './constants'
import { OBJECT_FILTER_LABELS, PACKAGE_FILTER_LABELS } from './i18n'
import TablePage from './TablePage'

export function useMobileView() {
  const t = M.useTheme()
  return M.useMediaQuery(t.breakpoints.down('sm'))
}

export type ComponentProps = React.PropsWithChildren<{ className?: string }>

const useColumnTitleStyles = M.makeStyles((t) => ({
  root: {
    ...t.typography.h6,
    lineHeight: `${t.spacing(4.5)}px`,
  },
}))

function ColumnTitle({ className, children }: ComponentProps) {
  const classes = useColumnTitleStyles()
  return <div className={cx(classes.root, className)}>{children}</div>
}

const useFiltersButtonStyles = M.makeStyles((t) => ({
  root: {
    background: t.palette.background.paper,
  },
}))

interface FiltersButtonProps {
  className: string
  onClick: () => void
}

function FiltersButton({ className, onClick }: FiltersButtonProps) {
  const classes = useFiltersButtonStyles()
  return (
    <M.Button
      startIcon={<M.Icon fontSize="inherit">filter_list</M.Icon>}
      variant="outlined"
      className={cx(classes.root, className)}
      onClick={onClick}
    >
      Filters
    </M.Button>
  )
}

const useScrollToTopStyles = M.makeStyles((t) => ({
  root: {
    position: 'fixed',
    left: '50%',
    bottom: t.spacing(3),
    transform: `translateX(-50%)`,
  },
  button: {
    background: t.palette.background.paper,
  },
  icon: {
    marginRight: t.spacing(1),
  },
}))

export function ScrollToTop() {
  const model = SearchUIModel.use()
  const trigger = M.useScrollTrigger({ disableHysteresis: true })
  const classes = useScrollToTopStyles()
  const onClick = React.useCallback(
    () => window.scrollTo({ top: 0, left: 0, behavior: 'smooth' }),
    [],
  )
  return (
    <M.Fade in={!!trigger}>
      <M.Container
        className={classes.root}
        maxWidth={model.state.view === SearchUIModel.View.Table ? false : 'lg'}
      >
        <M.Fab className={classes.button} onClick={onClick} variant="extended">
          <M.Icon className={classes.icon}>expand_less</M.Icon>
          Scroll to the top
        </M.Fab>
      </M.Container>
    </M.Fade>
  )
}

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

function FilterSection({ children, className }: ComponentProps) {
  const classes = useFilterSectionStyles()
  return <div className={cx(classes.root, className)}>{children}</div>
}

const useMoreButtonStyles = M.makeStyles({
  title: {
    paddingLeft: '3px',
  },
})

interface MoreButtonProps extends M.ButtonProps {
  reverse?: boolean
}

function MoreButton({ reverse, ...props }: MoreButtonProps) {
  const classes = useMoreButtonStyles()
  return (
    <M.Button
      startIcon={<M.Icon>{reverse ? 'expand_less' : 'expand_more'}</M.Icon>}
      size="small"
      {...props}
    >
      <span className={classes.title}>{reverse ? 'Less filters' : 'More filters'}</span>
    </M.Button>
  )
}

interface PackagesFilterActivatorProps {
  field: keyof SearchUIModel.PackagesSearchFilter
}

function PackagesFilterActivator({ field }: PackagesFilterActivatorProps) {
  const model = SearchUIModel.use(SearchUIModel.ResultType.QuiltPackage)
  const { activatePackagesFilter } = model.actions
  const activate = React.useCallback(() => {
    activatePackagesFilter(field)
  }, [activatePackagesFilter, field])
  return <FiltersUI.Activator title={PACKAGE_FILTER_LABELS[field]} onClick={activate} />
}

interface PackagesFilterProps {
  className?: string
  field: keyof SearchUIModel.PackagesSearchFilter
}

function PackagesFilter({ className, field }: PackagesFilterProps) {
  const model = SearchUIModel.use(SearchUIModel.ResultType.QuiltPackage)
  const predicateState = model.state.filter.predicates[field]
  invariant(predicateState, 'Filter not active')

  const extents = SearchUIModel.usePackageSystemMetaFacetExtents(field)

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
      title={PACKAGE_FILTER_LABELS[field]}
    >
      <FilterWidget state={predicateState} extents={extents} onChange={change} />
    </FiltersUI.Container>
  )
}

interface PackagesMetaFilterActivatorProps {
  typename: SearchUIModel.PackageUserMetaFacet['__typename']
  path: SearchUIModel.PackageUserMetaFacet['path']
  label: React.ReactNode
  disabled?: boolean
}

function PackagesMetaFilterActivator({
  typename,
  path,
  label,
  disabled,
}: PackagesMetaFilterActivatorProps) {
  const model = SearchUIModel.use(SearchUIModel.ResultType.QuiltPackage)
  const { activatePackagesMetaFilter } = model.actions
  const type = SearchUIModel.PackageUserMetaFacetMap[typename]
  const activate = React.useCallback(() => {
    activatePackagesMetaFilter(path, type)
  }, [activatePackagesMetaFilter, path, type])
  return <FiltersUI.Activator title={label} onClick={activate} disabled={disabled} />
}

interface PackageMetaFilterProps {
  className?: string
  path: string
}

function PackagesMetaFilter({ className, path }: PackageMetaFilterProps) {
  const model = SearchUIModel.use(SearchUIModel.ResultType.QuiltPackage)

  const predicateState = model.state.userMetaFilters.filters.get(path)
  invariant(predicateState, 'Filter not active')

  const { deactivatePackagesMetaFilter, setPackagesMetaFilter } = model.actions

  const deactivate = React.useCallback(() => {
    deactivatePackagesMetaFilter(path)
  }, [deactivatePackagesMetaFilter, path])

  const change = React.useCallback(
    (state: SearchUIModel.PredicateState<SearchUIModel.KnownPredicate>) => {
      setPackagesMetaFilter(path, state)
    },
    [setPackagesMetaFilter, path],
  )

  const title = React.useMemo(() => JSONPointer.parse(path).join(' / '), [path])

  const { fetching, extents } = SearchUIModel.usePackageUserMetaFacetExtents(path)

  return (
    <FiltersUI.Container
      className={className}
      defaultExpanded
      onDeactivate={deactivate}
      title={title}
    >
      {fetching ? (
        <>
          <Skeleton height={32} />
          <Skeleton height={32} mt={1} />
        </>
      ) : (
        <FilterWidget state={predicateState} extents={extents} onChange={change} />
      )}
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
    paddingLeft: t.spacing(3),
  },
  iconWrapper: {
    minWidth: t.spacing(4),
  },
  icon: {
    transition: 'ease .15s transform',
  },
  expanded: {
    transform: 'rotate(90deg)',
  },
}))

interface FilterGroupProps {
  disabled?: boolean
  path?: string
  items: SearchUIModel.FacetTree['children']
}

function FilterGroup({ disabled, path, items }: FilterGroupProps) {
  const classes = useFilterGroupStyles()

  function getLabel(key: string) {
    const [type, rest] = key.split(':')
    switch (type) {
      case 'path':
        return rest
      case 'type':
        return `Type: ${rest}`
      default:
        return key
    }
  }

  const [expanded, setExpanded] = React.useState(false)
  const toggleExpanded = React.useCallback(() => setExpanded((x) => !x), [])

  return (
    <li className={cx(classes.root)}>
      <ul className={classes.auxList}>
        {!!path && (
          <M.ListItem disabled={disabled} button disableGutters onClick={toggleExpanded}>
            <M.ListItemIcon className={classes.iconWrapper}>
              <M.Icon className={cx(classes.icon, { [classes.expanded]: expanded })}>
                chevron_right
              </M.Icon>
            </M.ListItemIcon>
            <M.ListItemText primary={getLabel(path)} />
          </M.ListItem>
        )}
        <div className={cx({ [classes.nested]: !!path })}>
          <M.Collapse in={expanded || !path}>
            {Array.from(items).map(([p, node]) =>
              node._tag === 'Tree' ? (
                <FilterGroup
                  disabled={disabled}
                  items={node.children}
                  key={path + p}
                  path={p}
                />
              ) : (
                <PackagesMetaFilterActivator
                  disabled={disabled}
                  key={path + p}
                  label={getLabel(p)}
                  path={node.value.path}
                  typename={node.value.__typename}
                />
              ),
            )}
          </M.Collapse>
        </div>
      </ul>
    </li>
  )
}

const useAvailablePackagesMetaFiltersStyles = M.makeStyles((t) => ({
  list: {
    background: t.palette.background.default,
  },
  help: {
    ...t.typography.caption,
    marginBottom: t.spacing(1),
    marginTop: t.spacing(1),
  },
  input: {
    background: t.palette.background.paper,
    marginBottom: t.spacing(0.5),
  },
  more: {
    marginTop: t.spacing(0.5),
  },
}))

interface AvailablePackagesMetaFiltersProps {
  className?: string
  filtering: SearchUIModel.FacetsFilteringStateInstance
  facets: {
    available: readonly SearchUIModel.PackageUserMetaFacet[]
    visible: SearchUIModel.FacetTree
    hidden: SearchUIModel.FacetTree
  }
  fetching: boolean
}

function AvailablePackagesMetaFilters({
  className,
  filtering,
  facets,
  fetching,
}: AvailablePackagesMetaFiltersProps) {
  const classes = useAvailablePackagesMetaFiltersStyles()

  const [expanded, setExpanded] = React.useState(false)
  const toggleExpanded = React.useCallback(() => setExpanded((x) => !x), [])

  return (
    <div className={className}>
      {SearchUIModel.FacetsFilteringState.match({
        Enabled: ({ value, set }) => (
          <FiltersUI.TinyTextField
            placeholder="Find metadata"
            fullWidth
            value={value}
            onChange={set}
            className={classes.input}
          />
        ),
        Disabled: () => null,
      })(filtering)}
      {SearchUIModel.FacetsFilteringState.match({
        Enabled: ({ isFiltered, serverSide }) => {
          if (serverSide && !isFiltered) {
            return (
              <p className={classes.help}>
                Some metadata not displayed.
                <br />
                Enter search query to see more.
              </p>
            )
          }
          if (isFiltered && !facets.available.length) {
            return <p className={classes.help}>No metadata found matching your query</p>
          }
        },
        Disabled: () => null,
      })(filtering)}
      <M.List dense disablePadding className={classes.list}>
        <FilterGroup disabled={fetching} items={facets.visible.children} />
        <M.Collapse in={expanded}>
          <FilterGroup disabled={fetching} items={facets.hidden.children} />
        </M.Collapse>
      </M.List>
      {!!facets.hidden.children.size && (
        <MoreButton
          className={classes.more}
          disabled={fetching}
          onClick={toggleExpanded}
          reverse={expanded}
        />
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
  spinner: {
    marginLeft: t.spacing(1),
  },
}))

interface PackagesMetaFiltersProps {
  className: string
}

function PackagesMetaFilters({ className }: PackagesMetaFiltersProps) {
  const classes = usePackagesMetaFiltersStyles()

  const activated = SearchUIModel.use(SearchUIModel.ResultType.QuiltPackage).state
    .userMetaFilters.filters

  const activatedPaths = React.useMemo(() => Array.from(activated.keys()), [activated])

  return (
    <div className={className}>
      <div className={classes.title}>Package-level metadata</div>
      {activatedPaths.map((path) => (
        <FilterSection key={path}>
          <PackagesMetaFilter path={path} />
        </FilterSection>
      ))}
      <SearchUIModel.AvailablePackagesMetaFilters>
        {SearchUIModel.AvailableFiltersState.match({
          Loading: () => <M.Typography>Analyzing metadata&hellip;</M.Typography>,
          Empty: () =>
            activatedPaths.length ? null : <M.Typography>No metadata found</M.Typography>,
          Ready: (ready) => <AvailablePackagesMetaFilters {...ready} />,
        })}
      </SearchUIModel.AvailablePackagesMetaFilters>
    </div>
  )
}

const usePackagesRevisionFilterStyles = M.makeStyles((t) => ({
  root: {
    marginBottom: t.spacing(2),
  },
  hintIcon: {
    color: t.palette.divider,
    marginLeft: '4px',
    verticalAlign: '-4px',
    '&:hover': {
      color: t.palette.text.secondary,
    },
  },
}))

function PackagesRevisionFilter() {
  const classes = usePackagesRevisionFilterStyles()

  const model = SearchUIModel.use(SearchUIModel.ResultType.QuiltPackage)

  const { setPackagesLatestOnly } = model.actions

  const handleChange = React.useCallback(
    (_event: unknown, checked: boolean) => {
      setPackagesLatestOnly(!checked)
    },
    [setPackagesLatestOnly],
  )

  return (
    <M.FormControlLabel
      className={classes.root}
      control={<M.Switch checked={!model.state.latestOnly} onChange={handleChange} />}
      label={
        <>
          Include historical versions
          <M.Tooltip
            arrow
            title="Enable to show matches from prior versions, versus only in the latest revision"
          >
            <M.Icon className={classes.hintIcon} fontSize="small">
              help_outline
            </M.Icon>
          </M.Tooltip>
        </>
      }
    />
  )
}

const usePackageFiltersStyles = M.makeStyles((t) => ({
  root: {
    // make room for overflowing controls (e.g. a switch)
    marginLeft: '-12px',
    paddingLeft: '12px',
  },
  metadata: {
    marginTop: t.spacing(3),
  },
  title: {
    ...t.typography.h6,
    fontWeight: 400,
    marginBottom: t.spacing(1),
  },
  more: {
    marginTop: t.spacing(0.5),
  },
}))

interface PackageFiltersProps {
  className: string
}

export function PackageFilters({ className }: PackageFiltersProps) {
  const model = SearchUIModel.use(SearchUIModel.ResultType.QuiltPackage)
  const classes = usePackageFiltersStyles()

  const { order: activeFilters, predicates } = model.state.filter

  const availableFilters = PACKAGES_FILTERS_PRIMARY.filter((f) => !predicates[f])
  const moreFilters = PACKAGES_FILTERS_SECONDARY.filter((f) => !predicates[f])

  const [expanded, setExpanded] = React.useState(false)
  const toggleExpanded = React.useCallback(() => setExpanded((x) => !x), [])

  return (
    <div className={cx(classes.root, className)}>
      <div className={classes.title}>Revisions</div>
      <PackagesRevisionFilter />

      <div className={classes.title}>Filter by</div>

      {activeFilters.map((f) => (
        <FilterSection key={f}>
          <PackagesFilter field={f} />
        </FilterSection>
      ))}

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

interface ObjectsFilterActivatorProps {
  field: keyof SearchUIModel.ObjectsSearchFilter
}

function ObjectsFilterActivator({ field }: ObjectsFilterActivatorProps) {
  const model = SearchUIModel.use(SearchUIModel.ResultType.S3Object)
  const { activateObjectsFilter } = model.actions
  const activate = React.useCallback(() => {
    activateObjectsFilter(field)
  }, [activateObjectsFilter, field])
  return <FiltersUI.Activator title={OBJECT_FILTER_LABELS[field]} onClick={activate} />
}

interface ObjectsFilterProps {
  className?: string
  field: keyof SearchUIModel.ObjectsSearchFilter
}

function ObjectsFilter({ className, field }: ObjectsFilterProps) {
  const model = SearchUIModel.use(SearchUIModel.ResultType.S3Object)
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
      title={OBJECT_FILTER_LABELS[field]}
    >
      <FilterWidget state={predicateState} extents={extents} onChange={change} />
    </FiltersUI.Container>
  )
}

const OBJECTS_FILTERS_PRIMARY = ['modified', 'ext'] as const

const OBJECTS_FILTERS_SECONDARY = ['size', 'key', 'content', 'deleted'] as const

const useObjectFiltersStyles = M.makeStyles((t) => ({
  more: {
    marginTop: t.spacing(0.5),
  },
  title: {
    ...t.typography.h6,
    fontWeight: 400,
    marginBottom: t.spacing(1),
  },
}))

interface ObjectFiltersProps {
  className: string
}

export function ObjectFilters({ className }: ObjectFiltersProps) {
  const model = SearchUIModel.use(SearchUIModel.ResultType.S3Object)
  const classes = useObjectFiltersStyles()

  const { order: activeFilters, predicates } = model.state.filter

  const availableFilters = OBJECTS_FILTERS_PRIMARY.filter((f) => !predicates[f])
  const moreFilters = OBJECTS_FILTERS_SECONDARY.filter((f) => !predicates[f])

  const [expanded, setExpanded] = React.useState(false)
  const toggleExpanded = React.useCallback(() => setExpanded((x) => !x), [])

  return (
    <div className={className}>
      <div className={classes.title}>Filter by</div>

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
    paddingBottom: t.spacing(12), // space reserved for "Scroll to top"
    // TODO: Make scroll for sidebar
    // TODO: Also, consider that buckets filter disappears
    // overflow: 'hidden auto',
    // padding: t.spacing(0.5, 0, 0),
    // height: `calc(100vh - ${t.spacing(4 + 8)}px)` // -padding -header
  },
  variable: {
    marginTop: t.spacing(1),
    overflow: 'hidden auto',
  },
}))

interface FiltersProps {
  className?: string
}

function Filters({ className }: FiltersProps) {
  const classes = useFiltersStyles()
  const model = SearchUIModel.use()
  return (
    <div className={cx(classes.root, className)}>
      <ColumnTitle>Search for</ColumnTitle>
      <ResultTypeSelector />
      <BucketSelector />
      {model.state.resultType === SearchUIModel.ResultType.QuiltPackage ? (
        <PackageFilters className={classes.variable} />
      ) : (
        <ObjectFilters className={classes.variable} />
      )}
      <ScrollToTop />
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
  singleBucket: boolean
  latestOnly: boolean
}

function ResultsPage({
  className,
  hits,
  cursor,
  resultType,
  singleBucket,
  latestOnly,
}: ResultsPageProps) {
  const classes = useResultsPageStyles()
  const [more, setMore] = React.useState(false)
  const loadMore = React.useCallback(() => {
    setMore(true)
  }, [])

  return (
    <div className={className}>
      <Views.ListView hits={hits} singleBucket={singleBucket} latestOnly={latestOnly} />
      {!!cursor &&
        (more ? (
          <NextPage
            after={cursor}
            className={classes.next}
            resultType={resultType}
            singleBucket={singleBucket}
            latestOnly={latestOnly}
          />
        ) : (
          <Views.Next className={classes.next} onClick={loadMore} />
        ))}
    </div>
  )
}

interface NextPageProps {
  after: string
  resultType: SearchUIModel.ResultType
  className: string
  singleBucket: boolean
  latestOnly: boolean
}

function NextPage({
  after,
  className,
  resultType,
  singleBucket,
  latestOnly,
}: NextPageProps) {
  const NextPageQuery =
    resultType === SearchUIModel.ResultType.S3Object
      ? SearchUIModel.NextPageObjectsQuery
      : SearchUIModel.NextPagePackagesQuery
  return (
    <NextPageQuery after={after}>
      {(r) => {
        switch (r._tag) {
          case 'fetching':
            return <Views.Next className={className} loading />
          case 'error':
            return (
              <Views.NoResults.Error className={className} details={r.error.message} />
            )
          case 'data':
            switch (r.data.__typename) {
              case 'InvalidInput':
                // should not happen
                const [err] = r.data.errors
                const details = (
                  <>
                    Invalid input at <code>{err.path}</code>: {err.name}
                    <br />
                    {err.message}
                  </>
                )
                return <Views.NoResults.Error className={className} details={details} />
              case 'PackagesSearchResultSetPage':
              case 'ObjectsSearchResultSetPage':
                return (
                  <ResultsPage
                    className={className}
                    hits={r.data.hits}
                    cursor={r.data.cursor}
                    resultType={resultType}
                    singleBucket={singleBucket}
                    latestOnly={latestOnly}
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
      return (
        <Views.NoResults.Skeleton className={className} type={model.state.resultType} />
      )
    case 'error':
      return <Views.NoResults.Error className={className} details={r.error.message} />
    case 'data':
      switch (r.data.__typename) {
        case 'EmptySearchResultSet':
          return <Views.NoResults.Empty className={className} />
        case 'InvalidInput':
          const [err] = r.data.errors
          const kind = err.name === 'QuerySyntaxError' ? 'syntax' : 'unexpected'
          const details =
            err.name === 'QuerySyntaxError' ? (
              err.message
            ) : (
              <>
                Invalid input at <code>{err.path}</code>: {err.name}
                <br />
                {err.message}
              </>
            )
          return (
            <Views.NoResults.Error className={className} kind={kind} details={details} />
          )
        case 'ObjectsSearchResultSet':
        case 'PackagesSearchResultSet':
          const latestOnly =
            model.state.resultType === SearchUIModel.ResultType.QuiltPackage
              ? model.state.latestOnly
              : true

          return (
            <ResultsPage
              className={className}
              key={`${model.state.resultType}:${r.data.firstPage.cursor}`}
              resultType={model.state.resultType}
              hits={r.data.firstPage.hits}
              cursor={r.data.firstPage.cursor}
              singleBucket={model.state.buckets.length === 1}
              latestOnly={latestOnly}
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
      return <Skeleton width={140} height={24} />
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
            <ColumnTitle>
              <Format.Plural
                value={r.data.stats.total}
                one="1 result"
                other={(n) => (n > 0 ? `${n} results` : 'Results')}
              />
            </ColumnTitle>
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
    // make space for box shadows
    margin: '-4px',
    overflow: 'hidden',
    padding: '4px',
  },
  button: {
    '& + &': {
      marginLeft: t.spacing(1),
    },
  },
  controls: {
    display: 'flex',
    marginLeft: 'auto',
  },
  results: {
    marginTop: t.spacing(2),
  },
  toggleButton: {
    padding: '5px',
  },
  toolbar: {
    alignItems: 'flex-end',
    display: 'flex',
    minHeight: '36px',
  },
}))

interface ResultsProps {
  onFilters: () => void
}

export function Results({ onFilters }: ResultsProps) {
  const model = SearchUIModel.use()
  const classes = useResultsStyles()
  const isMobile = useMobileView()
  const { setView } = model.actions
  return (
    <div className={classes.root}>
      <div className={classes.toolbar}>
        <ResultsCount />
        <div className={classes.controls}>
          {model.state.resultType === SearchUIModel.ResultType.QuiltPackage && (
            <Lab.ToggleButtonGroup
              value={model.state.view}
              className={classes.button}
              exclusive
              onChange={(_e, value) => setView(value)}
              size="small"
            >
              <Lab.ToggleButton
                value={SearchUIModel.View.Table}
                className={classes.toggleButton}
              >
                <M.Icon>grid_on</M.Icon>
              </Lab.ToggleButton>
              <Lab.ToggleButton
                value={SearchUIModel.View.List}
                className={classes.toggleButton}
              >
                <M.Icon>list</M.Icon>
              </Lab.ToggleButton>
            </Lab.ToggleButtonGroup>
          )}
          {isMobile && <FiltersButton className={classes.button} onClick={onFilters} />}
          <SortSelector className={classes.button} />
        </div>
      </div>
      {model.state.view === SearchUIModel.View.Table &&
      model.state.resultType === SearchUIModel.ResultType.QuiltPackage ? (
        <TablePage className={classes.results} />
      ) : (
        <ResultsInner className={classes.results} />
      )}
    </div>
  )
}

const useStyles = M.makeStyles((t) => ({
  root: {
    [t.breakpoints.up('md')]: {
      alignItems: 'start',
      display: 'grid',
      gridColumnGap: t.spacing(2),
      gridTemplateColumns: `${t.spacing(40)}px auto`,
    },
    padding: t.spacing(3),
  },
  filtersMobile: {
    padding: t.spacing(2),
    minWidth: `min(${t.spacing(40)}px, 100vw)`,
  },
  filtersClose: {
    position: 'absolute',
    right: '2px',
    top: '10px',
  },
  [SearchUIModel.View.Table]: {
    animation: t.transitions.create('$expand'),
  },
  [SearchUIModel.View.List]: {
    animation: t.transitions.create('$collapse'),
  },
  '@keyframes expand': {
    '0%': {
      transform: 'scaleX(0.94)',
    },
    '100%': {
      transform: 'scaleX(1)',
    },
  },
  '@keyframes collapse': {
    '0%': {
      opacity: 0.3,
    },
    '100%': {
      opacity: 1,
    },
  },
}))

function SearchLayout() {
  const model = SearchUIModel.use()
  const classes = useStyles()
  const isMobile = useMobileView()
  const [showFilters, setShowFilters] = React.useState(false)
  return (
    <M.Container
      className={cx(classes.root, classes[model.state.view])}
      maxWidth={model.state.view === SearchUIModel.View.Table ? false : 'lg'}
    >
      <MetaTitle>{model.state.searchString || 'Search'}</MetaTitle>
      {isMobile ? (
        <M.Drawer anchor="left" open={showFilters} onClose={() => setShowFilters(false)}>
          <Filters className={classes.filtersMobile} />
          <M.IconButton
            className={classes.filtersClose}
            onClick={() => setShowFilters(false)}
          >
            <M.Icon>close</M.Icon>
          </M.IconButton>
        </M.Drawer>
      ) : (
        <Filters />
      )}
      <Results onFilters={() => setShowFilters((x) => !x)} />
    </M.Container>
  )
}

export default function Search() {
  return (
    <SearchUIModel.Provider>
      <AssistantContext />
      <Layout pre={<SearchLayout />} />
    </SearchUIModel.Provider>
  )
}
