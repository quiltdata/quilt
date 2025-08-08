import invariant from 'invariant'
import cx from 'classnames'
import * as React from 'react'
import * as RRDom from 'react-router-dom'
import * as M from '@material-ui/core'

import * as FiltersUI from 'components/Filters'
import Skeleton from 'components/Skeleton'
import * as JSONPointer from 'utils/JSONPointer'
import * as NamedRoutes from 'utils/NamedRoutes'

import FilterWidget from '../FilterWidget'
import { PACKAGE_FILTER_LABELS } from '../i18n'
import { PACKAGES_FILTERS_PRIMARY, PACKAGES_FILTERS_SECONDARY } from '../constants'
import * as SearchUIModel from '../model'

import ColumnTitle from './ColumnTitle'
import FilterSection from './FilterSection'
import MoreButton from './MoreButton'

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
    background: 'inherit',
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

  const { fetching, extents } = SearchUIModel.usePackageSystemMetaFacetExtents(field)

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
      {!fetching && (
        <FilterWidget state={predicateState} extents={extents} onChange={change} />
      )}
    </FiltersUI.Container>
  )
}

const usePackagesRevisionFilterStyles = M.makeStyles((t) => ({
  hintIcon: {
    color: t.palette.divider,
    marginLeft: '4px',
    verticalAlign: '-4px',
    '&:hover': {
      color: t.palette.text.secondary,
    },
  },
}))

interface PackagesRevisionFilterProps {
  className?: string
}

function PackagesRevisionFilter({ className }: PackagesRevisionFilterProps) {
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
      className={className}
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
  gutterBottom: {
    marginBottom: t.spacing(2),
  },
  gutterTop: {
    marginTop: t.spacing(2),
  },
  subTitle: {
    ...t.typography.body2,
    fontWeight: 500,
    marginBottom: t.spacing(0.5),
  },
  more: {
    marginTop: t.spacing(0.5),
  },
}))

interface PackageFiltersProps {
  className: string
}

export default function PackageFilters({ className }: PackageFiltersProps) {
  const model = SearchUIModel.use(SearchUIModel.ResultType.QuiltPackage)
  const classes = usePackageFiltersStyles()

  const { order: activeFilters, predicates } = model.state.filter

  const availableFilters = PACKAGES_FILTERS_PRIMARY.filter((f) => !predicates[f])
  const moreFilters = PACKAGES_FILTERS_SECONDARY.filter((f) => !predicates[f])

  const [expanded, setExpanded] = React.useState(false)
  const toggleExpanded = React.useCallback(() => setExpanded((x) => !x), [])

  const { paths } = NamedRoutes.use()

  return (
    <div className={cx(classes.root, className)}>
      <RRDom.Switch>
        <RRDom.Route path={paths.search} exact>
          <div className={classes.title}>Revisions</div>
          <PackagesRevisionFilter />

          <div className={cx(classes.title, classes.gutterTop)}>Filter by</div>
        </RRDom.Route>
        <RRDom.Route>
          <ColumnTitle className={classes.gutterBottom}>Filter by</ColumnTitle>
          <FilterSection>
            <FiltersUI.Container defaultExpanded title="Revisions">
              <PackagesRevisionFilter />
            </FiltersUI.Container>
          </FilterSection>
        </RRDom.Route>
      </RRDom.Switch>

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
