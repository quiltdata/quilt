import cx from 'classnames'
import invariant from 'invariant'
import * as React from 'react'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'
import { VisibilityOffOutlined as IconVisibilityOffOutlined } from '@material-ui/icons'

import { TinyTextField, List } from 'components/Filters'
import * as BucketConfig from 'utils/BucketConfig'
import assertNever from 'utils/assertNever'
import type { PackageHandle } from 'utils/packageHandle'

import FilterWidget from '../FilterWidget'
import { PACKAGES_FILTERS_PRIMARY, PACKAGES_FILTERS_SECONDARY } from '../constants'
import { PACKAGE_FILTER_LABELS } from '../i18n'
import * as SearchUIModel from '../model'

import Entries from './Entries'
import CellValue from './CellValue'
import * as Skeleton from './Skeleton'
import * as Workflow from './workflow'
import { ColumnTag, useColumns } from './useColumns'
import type {
  Column,
  ColumnBucket,
  ColumnSystemMeta,
  ColumnUserMeta,
  ColumnsMap,
} from './useColumns'
import { Provider, useContext } from './Provider'

interface AvailableSystemMetaColumnProps {
  column: ColumnSystemMeta
  onClose: () => void
}

function AvailableSystemMetaColumn({ column, onClose }: AvailableSystemMetaColumnProps) {
  const model = SearchUIModel.use(SearchUIModel.ResultType.QuiltPackage)
  const {
    filterActions: { open },
    columnsActions: { show, hide },
  } = useContext()
  const { activatePackagesFilter, deactivatePackagesFilter } = model.actions

  const showColumn = React.useCallback(() => {
    if (!model.state.filter.predicates[column.filter]) {
      activatePackagesFilter(column.filter)
    }

    if (!column.state.visible) {
      show(column.filter)
    }

    if (!column.state.filtered) {
      open(column)
      onClose()
    }
  }, [activatePackagesFilter, column, model.state.filter.predicates, onClose, open, show])

  const hideColumn = React.useCallback(() => {
    if (column.state.filtered) {
      hide(column.filter)
    } else {
      if (column.filter === 'name') {
        hide(column.filter)
      }
      deactivatePackagesFilter(column.filter)
    }
  }, [column, deactivatePackagesFilter, hide])

  const handleChange = React.useCallback(
    (_e, checked) => (checked ? showColumn() : hideColumn()),
    [showColumn, hideColumn],
  )

  return (
    <M.MenuItem onClick={showColumn} selected={column.state.filtered}>
      <M.ListItemText
        primary={PACKAGE_FILTER_LABELS[column.filter]}
        secondary={column.state.filtered && 'Filters applied'}
      />
      <M.ListItemSecondaryAction>
        <M.Checkbox edge="end" onChange={handleChange} checked={column.state.visible} />
      </M.ListItemSecondaryAction>
    </M.MenuItem>
  )
}

function AvailableColumnsSkeleton() {
  return (
    <M.List>
      <M.ListItem>
        <M.ListItemText primary={<Lab.Skeleton />} />
        <M.ListItemSecondaryAction>
          <Lab.Skeleton>
            <M.Icon />
          </Lab.Skeleton>
        </M.ListItemSecondaryAction>
      </M.ListItem>
      <M.ListItem>
        <M.ListItemText primary={<Lab.Skeleton />} />
        <M.ListItemSecondaryAction>
          <Lab.Skeleton>
            <M.Icon />
          </Lab.Skeleton>
        </M.ListItemSecondaryAction>
      </M.ListItem>
      <M.ListItem>
        <M.ListItemText primary={<Lab.Skeleton />} />
        <M.ListItemSecondaryAction>
          <Lab.Skeleton>
            <M.Icon />
          </Lab.Skeleton>
        </M.ListItemSecondaryAction>
      </M.ListItem>
    </M.List>
  )
}

function getLabel(key: string) {
  const [type, rest] = key.split(':')
  switch (type) {
    case 'path':
      return { primary: rest }
    case 'type':
      return { primary: rest, secondary: 'Type' }
    default:
      return { primary: key }
  }
}

interface AvailableUserMetaColumnProps extends M.ListItemTextProps {
  column: ColumnUserMeta
  onClose: () => void
}

function AvailableUserMetaColumn({
  column,
  onClose,
  ...props
}: AvailableUserMetaColumnProps) {
  const model = SearchUIModel.use(SearchUIModel.ResultType.QuiltPackage)
  const {
    filterActions: { open },
    columnsActions: { show, hide },
  } = useContext()
  const { activatePackagesMetaFilter, deactivatePackagesMetaFilter } = model.actions
  const showColumn = React.useCallback(() => {
    activatePackagesMetaFilter(column.filter, column.predicateType)
    if (!column.state.visible) {
      show(column.filter)
    }
    if (!column.state.filtered) {
      open(column)
      onClose()
    }
  }, [activatePackagesMetaFilter, column, open, show, onClose])

  const hideColumn = React.useCallback(() => {
    if (column.state.filtered || column.state.inferred) {
      hide(column.filter)
    } else {
      deactivatePackagesMetaFilter(column.filter)
    }
  }, [column, hide, deactivatePackagesMetaFilter])

  const handleChange = React.useCallback(
    (_e, checked) => (checked ? showColumn() : hideColumn()),
    [showColumn, hideColumn],
  )
  return (
    <M.MenuItem onClick={showColumn}>
      <M.ListItemText {...props} />
      <M.ListItemSecondaryAction>
        <M.Checkbox edge="end" onChange={handleChange} checked={column.state.visible} />
      </M.ListItemSecondaryAction>
    </M.MenuItem>
  )
}

const useUnfoldPackageEntriesStyles = M.makeStyles((t) => ({
  badge: {
    background: t.palette.text.hint,
    color: t.palette.getContrastText(t.palette.text.hint),
  },
  expanded: {
    opacity: 1,
    animation: t.transitions.create('$expanded'),
  },
  collapsed: {
    animation: t.transitions.create('$collapsed'),
  },
  '@keyframes expanded': {
    '0%': {
      transform: 'rotate(-42deg)',
    },
    '100%': {
      transform: 'rotate(0deg)',
    },
  },
  '@keyframes collapsed': {
    '0%': {
      transform: 'rotate(42deg)',
    },
    '100%': {
      transform: 'rotate(0deg)',
    },
  },
}))

interface UnfoldPackageEntriesProps {
  className: string
  open: boolean
  size: number
}

function UnfoldPackageEntries({ className, open, size }: UnfoldPackageEntriesProps) {
  const classes = useUnfoldPackageEntriesStyles()
  const title = open
    ? 'Hide entries'
    : `Show ${size} matching ${size === 1 ? 'entry' : 'entries'}`
  return (
    <M.Tooltip arrow title={title}>
      <M.IconButton className={className}>
        <M.Badge badgeContent={size} color="default" classes={{ badge: classes.badge }}>
          <M.Icon className={open ? classes.expanded : classes.collapsed}>
            {open ? 'expand_more' : 'chevron_right'}
          </M.Icon>
        </M.Badge>
      </M.IconButton>
    </M.Tooltip>
  )
}

const usePackageRowStyles = M.makeStyles((t) => ({
  root: {
    '&:hover $fold': {
      color: t.palette.text.primary,
    },
  },
  cell: {
    maxWidth: '500px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  entries: {
    borderBottom: 0,
    padding: 0,
    verticalAlign: 'top',
    '&:last-child': {
      padding: 0,
    },
  },
  fold: {
    color: t.palette.text.secondary,
    transition: t.transitions.create('color'),
  },
  unfolded: {
    background: t.palette.action.selected,
    '& $fold': {
      color: t.palette.text.primary,
    },
  },
  placeholder: {
    width: t.spacing(5),
  },
}))

interface PackageRowProps {
  hit: SearchUIModel.SearchHitPackage
  columns: ColumnsMap
  skeletons?: { key: number; width: number }[]
}

function PackageRow({ columns, hit, skeletons }: PackageRowProps) {
  const classes = usePackageRowStyles()
  const [open, setOpen] = React.useState(false)
  const toggle = React.useCallback(() => setOpen((x) => !x), [])

  const packageHandle: PackageHandle = React.useMemo(
    () => ({
      bucket: hit.bucket,
      name: hit.name,
      hash: hit.hash,
    }),
    [hit],
  )

  const visibleColumns = Array.from(columns.values()).filter((c) => c.state.visible)

  return (
    <>
      <M.TableRow
        hover
        className={cx(classes.root, open && classes.unfolded)}
        onClick={toggle}
      >
        <M.TableCell padding="checkbox">
          {!!hit.matchingEntries?.length && (
            <UnfoldPackageEntries
              className={classes.fold}
              open={open}
              size={hit.matchingEntries.length}
            />
          )}
        </M.TableCell>
        {visibleColumns.map((column) => (
          <M.TableCell
            key={column.filter}
            className={classes.cell}
            {...(column.tag === ColumnTag.UserMeta && {
              ['data-search-hit-meta']: column.filter,
            })}
            {...(column.tag === ColumnTag.SystemMeta && {
              ['data-search-hit-filter']: column.filter,
            })}
          >
            <CellValue hit={hit} column={column} />
          </M.TableCell>
        ))}
        {skeletons?.map(({ key, width }) => <Skeleton.Cell key={key} width={width} />)}
        <M.TableCell className={classes.placeholder} />
      </M.TableRow>
      {!!hit.matchingEntries?.length && (
        <M.TableRow>
          <M.TableCell
            className={classes.entries}
            colSpan={visibleColumns.length + 2 + (skeletons?.length || 0)}
          >
            {open && (
              <Entries
                entries={hit.matchingEntries}
                packageHandle={packageHandle}
                totalCount={hit.totalEntriesCount}
              />
            )}
          </M.TableCell>
        </M.TableRow>
      )}
    </>
  )
}

interface FilterDialogProps {
  column: Column
  onClose: () => void
}

function FilterDialog({ column, onClose }: FilterDialogProps) {
  switch (column.tag) {
    case ColumnTag.SystemMeta:
      return <FilterDialogSystemMeta column={column} onClose={onClose} />
    case ColumnTag.UserMeta:
      return <FilterDialogUserMeta column={column} onClose={onClose} />
    case ColumnTag.Bucket:
      return <FilterDialogBuckets column={column} onClose={onClose} />
  }
}

const useFilterDialogLayoutStyles = M.makeStyles((t) => ({
  content: {
    display: 'flex',
    flexDirection: 'column',
    overflow: 'visible',
  },
  reset: {
    marginRight: 'auto',
    color: t.palette.error.dark,
  },
}))

interface FilterDialogLayoutProps {
  onClose: () => void
  title: string
  children: React.ReactNode
  onReset: () => void
  modified: boolean
  onSubmit: () => void
  resetTitle?: string
}

function FilterDialogLayout({
  children,
  onClose,
  title,
  onReset,
  onSubmit,
  modified,
  resetTitle,
}: FilterDialogLayoutProps) {
  const classes = useFilterDialogLayoutStyles()
  const handleReset = React.useCallback(() => {
    onReset()
    onClose()
  }, [onClose, onReset])
  const handleSubmit = React.useCallback(() => {
    onSubmit()
    onClose()
  }, [onClose, onSubmit])
  return (
    <>
      <M.DialogTitle>{title}</M.DialogTitle>
      <M.DialogContent className={classes.content}>{children}</M.DialogContent>
      <M.DialogActions>
        <M.Tooltip title={resetTitle || ''}>
          <M.Button
            className={classes.reset}
            onClick={handleReset}
            color="inherit"
            disabled={modified}
          >
            Reset
          </M.Button>
        </M.Tooltip>

        <M.Button color="primary" onClick={onClose}>
          {modified ? 'Cancel' : 'Close'}
        </M.Button>
        <M.Button
          color="primary"
          variant="contained"
          onClick={handleSubmit}
          disabled={!modified}
        >
          Apply
        </M.Button>
      </M.DialogActions>
    </>
  )
}

interface FilterDialogSystemMetaProps extends FilterDialogProps {
  column: ColumnSystemMeta
}

function FilterDialogSystemMeta({ column, onClose }: FilterDialogSystemMetaProps) {
  const model = SearchUIModel.use(SearchUIModel.ResultType.QuiltPackage)

  const [innerState, setInnerState] = React.useState<$TSFixMe>(null)

  const onSubmit = React.useCallback(
    () => innerState && model.actions.setPackagesFilter(column.filter, innerState),
    [column, innerState, model.actions],
  )

  const onReset = React.useCallback(
    () => model.actions.deactivatePackagesFilter(column.filter),
    [column, model.actions],
  )

  return (
    <FilterDialogLayout
      onClose={onClose}
      title={column.fullTitle}
      onReset={onReset}
      onSubmit={onSubmit}
      modified={!!innerState}
      resetTitle="Clear filter values and remove column"
    >
      <Filter filter={column.filter} value={innerState} onChange={setInnerState} />
    </FilterDialogLayout>
  )
}

interface FilterDialogUserMetaProps extends FilterDialogProps {
  column: ColumnUserMeta
}

function FilterDialogUserMeta({ column, onClose }: FilterDialogUserMetaProps) {
  const model = SearchUIModel.use(SearchUIModel.ResultType.QuiltPackage)

  const [innerState, setInnerState] =
    React.useState<SearchUIModel.PredicateState<SearchUIModel.KnownPredicate> | null>(
      null,
    )

  const onSubmit = React.useCallback(
    () => innerState && model.actions.setPackagesMetaFilter(column.filter, innerState),
    [column, innerState, model.actions],
  )

  const onReset = React.useCallback(
    () => model.actions.deactivatePackagesMetaFilter(column.filter),
    [column, model.actions],
  )

  return (
    <FilterDialogLayout
      onClose={onClose}
      title={column.title}
      onReset={onReset}
      onSubmit={onSubmit}
      modified={!!innerState}
    >
      <MetaFilter path={column.filter} value={innerState} onChange={setInnerState} />
    </FilterDialogLayout>
  )
}

interface FilterDialogBucketsProps extends FilterDialogProps {
  column: ColumnBucket
}

function FilterDialogBuckets({ column, onClose }: FilterDialogBucketsProps) {
  const model = SearchUIModel.use(SearchUIModel.ResultType.QuiltPackage)

  const [innerState, setInnerState] = React.useState<readonly string[] | null>(null)

  const onSubmit = React.useCallback(
    () => innerState && model.actions.setBuckets(innerState),
    [innerState, model.actions],
  )

  // `bucket` column exists on the `/search` page only
  // it is hidden on the `/b/bucket/packages` page
  const onReset = React.useCallback(() => model.actions.setBuckets([]), [model.actions])

  return (
    <FilterDialogLayout
      onClose={onClose}
      title={column.title}
      onReset={onReset}
      onSubmit={onSubmit}
      modified={!!innerState}
      resetTitle="Show results for all buckets"
    >
      <BucketsFilter value={innerState} onChange={setInnerState} />
    </FilterDialogLayout>
  )
}

interface FilterProps {
  filter: keyof SearchUIModel.PackagesSearchFilter
  onChange: (state: SearchUIModel.PredicateState<SearchUIModel.KnownPredicate>) => void
  value: null | SearchUIModel.PredicateState<SearchUIModel.KnownPredicate>
}

function Filter({ filter, onChange, value }: FilterProps) {
  const model = SearchUIModel.use(SearchUIModel.ResultType.QuiltPackage)
  const initialValue = model.state.filter.predicates[filter]
  invariant(initialValue, 'Filter not active')
  const extents = SearchUIModel.usePackageSystemMetaFacetExtents(filter)

  return (
    <FilterWidget state={value || initialValue} extents={extents} onChange={onChange} />
  )
}

interface MetaFilterProps {
  path: string
  onChange: (state: SearchUIModel.PredicateState<SearchUIModel.KnownPredicate>) => void
  value: null | SearchUIModel.PredicateState<SearchUIModel.KnownPredicate>
}

function MetaFilter({ path, onChange, value }: MetaFilterProps) {
  const model = SearchUIModel.use(SearchUIModel.ResultType.QuiltPackage)
  const initialValue = model.state.userMetaFilters.filters.get(path)
  invariant(initialValue, 'Filter not active')

  const { fetching, extents } = SearchUIModel.usePackageUserMetaFacetExtents(path)
  return fetching ? (
    <M.Box display="grid" gridAutoFlow="row" gridRowGap={1}>
      <Lab.Skeleton height={32} />
      <Lab.Skeleton height={32} />
    </M.Box>
  ) : (
    <FilterWidget state={value || initialValue} extents={extents} onChange={onChange} />
  )
}

interface BucketsFilterProps {
  onChange: (state: readonly string[]) => void
  value: null | readonly string[]
}

function BucketsFilter({ onChange, value }: BucketsFilterProps) {
  const model = SearchUIModel.use(SearchUIModel.ResultType.QuiltPackage)
  const initialValue = model.state.buckets
  invariant(initialValue, 'Filter not active')

  const bucketConfigs = BucketConfig.useRelevantBucketConfigs()
  const extents = React.useMemo(() => bucketConfigs.map((b) => b.name), [bucketConfigs])
  return <List extents={extents} value={value || initialValue} onChange={onChange} />
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
}))

interface AvailableUserMetaColumnsTreeProps {
  columns: ColumnsMap
  disabled?: boolean
  items: SearchUIModel.FacetTree['children']
  onClose: () => void
  path?: string
}

function AvailableUserMetaColumnsTree({
  columns,
  disabled,
  items,
  onClose,
  path,
}: AvailableUserMetaColumnsTreeProps) {
  const classes = useFilterGroupStyles()

  const [expanded, setExpanded] = React.useState(false)
  const toggleExpanded = React.useCallback(() => setExpanded((x) => !x), [])

  return (
    <li className={cx(classes.root)}>
      <ul className={classes.auxList}>
        {!!path && (
          <M.ListItem disabled={disabled} button onClick={toggleExpanded}>
            <M.ListItemText primary={getLabel(path).primary} />
            <M.Icon>{expanded ? 'expand_less' : 'expand_more'}</M.Icon>
          </M.ListItem>
        )}
        <div className={cx({ [classes.nested]: !!path })}>
          <M.Collapse in={expanded || !path}>
            {Array.from(items).map(([p, node]) => {
              if (node._tag === 'Tree') {
                return (
                  <AvailableUserMetaColumnsTree
                    key={path + p}
                    disabled={disabled}
                    items={node.children}
                    path={p}
                    columns={columns}
                    onClose={onClose}
                  />
                )
              }
              const column = columns.get(node.value.path)
              if (!column || column.tag !== ColumnTag.UserMeta) {
                return (
                  <Lab.Alert key={path + p} severity="error">
                    Failed rendering {node.value.path}
                  </Lab.Alert>
                )
              }
              return (
                <AvailableUserMetaColumn
                  key={path + p}
                  column={column}
                  onClose={onClose}
                  {...getLabel(p)}
                />
              )
            })}
          </M.Collapse>
        </div>
      </ul>
    </li>
  )
}

const ReversPackageUserMetaTypename = {
  Number: 'NumberPackageUserMetaFacet' as const,
  Datetime: 'DatetimePackageUserMetaFacet' as const,
  KeywordEnum: 'KeywordPackageUserMetaFacet' as const,
  Text: 'TextPackageUserMetaFacet' as const,
  KeywordWildcard: 'KeywordPackageUserMetaFacet' as const,
  Boolean: 'BooleanPackageUserMetaFacet' as const,
}

function useAvailableSystemMetaColumns(columns: ColumnsMap, filterValue: string) {
  return React.useMemo(() => {
    const initial: ColumnSystemMeta[] = []
    return [...PACKAGES_FILTERS_PRIMARY, ...PACKAGES_FILTERS_SECONDARY].reduce(
      (memo, filter) => {
        const column = columns.get(filter)
        if (!column || column.tag !== ColumnTag.SystemMeta) return memo

        const combinedFilterString = (column.title + column.fullTitle).toLowerCase()
        if (!combinedFilterString.includes(filterValue)) return memo

        return [...memo, column]
      },
      initial,
    )
  }, [columns, filterValue])
}

interface AvailableUserMetaFacets {
  available: SearchUIModel.FacetTree['children'] | null
  fetching: boolean
}

function useAvailableUserMetaFacets(
  state: SearchUIModel.AvailableFiltersStateInstance,
  filterValue: string,
) {
  const model = SearchUIModel.use(SearchUIModel.ResultType.QuiltPackage)
  const selected = React.useMemo(
    () =>
      SearchUIModel.groupFacets(
        Array.from(model.state.userMetaFilters.filters)
          .map(([path, f]) => ({
            __typename: ReversPackageUserMetaTypename[f._tag],
            path,
          }))
          .filter(({ path }) => path.toLowerCase().includes(filterValue)),
      )[0].children,
    [model.state.userMetaFilters.filters, filterValue],
  )
  const { available, fetching } = React.useMemo(
    () =>
      SearchUIModel.AvailableFiltersState.match(
        {
          Loading: (): AvailableUserMetaFacets => ({ available: null, fetching: true }),
          Empty: (): AvailableUserMetaFacets => ({
            available: new Map(),
            fetching: false,
          }),
          Ready: (ready): AvailableUserMetaFacets => ({
            available: SearchUIModel.groupFacets(ready.facets.available)[0].children,
            fetching: ready.fetching,
          }),
        },
        state,
      ),
    [state],
  )

  return { selected, available, fetching }
}

const useAvailableColumnsStyles = M.makeStyles((t) => ({
  root: {
    animation: t.transitions.create('$fade'),
    background: t.palette.background.paper,
    overflowY: 'auto',
    flexGrow: 1,
  },
  divider: {
    marginTop: t.spacing(1),
  },
  list: {
    background: 'inherit',
  },
  '@keyframes fade': {
    '0%': {
      opacity: 0.7,
    },
    '100%': {
      opacity: 1,
    },
  },
}))

interface AvailableColumnsProps {
  columns: ColumnsMap
  onClose: () => void
  filterValue: string
  state: SearchUIModel.AvailableFiltersStateInstance
}

function AvailableColumns({
  filterValue,
  columns,
  onClose,
  state,
}: AvailableColumnsProps) {
  const classes = useAvailableColumnsStyles()

  const systemMetaColumns = useAvailableSystemMetaColumns(columns, filterValue)

  const { selected, available, fetching } = useAvailableUserMetaFacets(state, filterValue)

  const hasSystemMeta = !!systemMetaColumns.length
  const hasUserMeta = !!(selected.size || available?.size)

  return (
    <div className={classes.root}>
      <M.List className={classes.list} dense>
        {!hasSystemMeta && !hasUserMeta && (
          <M.ListItem>
            <M.ListItemText primary="Nothing found" />
          </M.ListItem>
        )}

        {!!hasSystemMeta && <M.ListSubheader>System metadata</M.ListSubheader>}

        {systemMetaColumns.map((column) => (
          <AvailableSystemMetaColumn
            key={column.filter}
            column={column}
            onClose={onClose}
          />
        ))}

        {hasSystemMeta && hasUserMeta && <M.Divider className={classes.divider} />}

        {hasUserMeta && <M.ListSubheader>User metadata</M.ListSubheader>}

        <AvailableUserMetaColumnsTree
          items={selected}
          columns={columns}
          onClose={onClose}
        />

        {available ? (
          <AvailableUserMetaColumnsTree
            items={available}
            columns={columns}
            disabled={fetching}
            onClose={onClose}
          />
        ) : (
          <AvailableColumnsSkeleton />
        )}
      </M.List>
    </div>
  )
}

const useConfigureColumnsStyles = M.makeStyles((t) => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    position: 'absolute',
    right: 0,
    top: 0,
    transition: t.transitions.create('width'),
    width: t.spacing(7),
    alignItems: 'flex-end',
    overflow: 'hidden',
    zIndex: 1,
  },
  add: {
    lineHeight: `${t.spacing(3)}px`,
    padding: t.spacing(1, 2),
  },
  head: {
    display: 'flex',
    justifyContent: 'center',
    boxShadow: '-2px 0 8px rgba(0, 0, 0, 0.3)',
    '& .MuiBadge-badge': {
      top: '4px',
      left: '-9px',
      right: 'auto',
    },
  },
  button: {
    height: t.spacing(5),
    width: t.spacing(5),
    color: t.palette.primary.main,
    background: t.palette.background.paper,
    borderTopRightRadius: t.shape.borderRadius,
    '&:focus': {
      border: `2px solid ${t.palette.primary.main}`,
    },
  },
  opened: {
    background: t.palette.background.paper,
    width: 'auto',
    minWidth: t.spacing(40),
    bottom: 0,
    boxShadow: t.shadows[2],
    animation: t.transitions.create('$slide'),
    alignItems: 'stretch',
    overflow: 'visible',
    '& $head': {
      background: t.palette.background.default,
      borderBottom: `1px solid ${t.palette.divider}`,
      justifyContent: 'flex-start',
      boxShadow: 'none',
    },
  },
  input: {
    margin: t.spacing(2, 1, 0),
  },
  '@keyframes slide': {
    '0%': {
      transform: `translateX(${t.spacing(2)}px)`,
    },
    '100%': {
      transform: 'translateX(0)',
    },
  },
}))

function useTextFilter(state: SearchUIModel.AvailableFiltersStateInstance) {
  const fallback = React.useState('')
  const ready = React.useMemo(
    () =>
      SearchUIModel.AvailableFiltersState.match(
        {
          Ready: (r) => r,
          Loading: () => null,
          Empty: () => null,
        },
        state,
      ),
    [state],
  )

  return React.useMemo(() => {
    if (!ready) return fallback
    return SearchUIModel.FacetsFilteringState.match({
      Enabled: ({ value, set }) => [value, set] as [string, (v: string) => void],
      Disabled: () => fallback,
    })(ready.filtering)
  }, [fallback, ready])
}

interface ConfigureColumnsProps {
  columns: ColumnsMap
  state: SearchUIModel.AvailableFiltersStateInstance
}

function ConfigureColumns({ columns, state }: ConfigureColumnsProps) {
  const classes = useConfigureColumnsStyles()

  const [open, setOpen] = React.useState(false)
  const show = React.useCallback(() => setOpen(true), [])
  const hide = React.useCallback(() => setOpen(false), [])

  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleMouseEnter = React.useCallback(() => {
    timeoutRef.current = setTimeout(show, 300)
  }, [show])

  const handleTimeout = React.useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  const handleMouseLeave = React.useCallback(() => {
    handleTimeout()
    hide()
  }, [handleTimeout, hide])

  const [filterValue, setFilterValue] = useTextFilter(state)

  const { hiddenColumns } = useContext()

  if (!open) {
    return (
      <div
        className={classes.root}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleTimeout}
        onClick={show}
      >
        <div className={classes.head}>
          <M.Badge
            color="secondary"
            invisible={!hiddenColumns.size}
            overlap="circle"
            variant="dot"
          >
            <M.ButtonBase className={classes.button}>
              <M.Icon>keyboard_arrow_down</M.Icon>
            </M.ButtonBase>
          </M.Badge>
        </div>
      </div>
    )
  }

  return (
    <div className={cx(classes.root, classes.opened)} onMouseLeave={handleMouseLeave}>
      <div className={classes.head}>
        <M.Typography variant="subtitle2" className={classes.add}>
          Configure columns:
        </M.Typography>
      </div>

      <TinyTextField
        autoFocus
        className={classes.input}
        onChange={setFilterValue}
        placeholder="Find metadata"
        value={filterValue}
      />

      <AvailableColumns
        columns={columns}
        filterValue={filterValue.toLowerCase()}
        onClose={hide}
        state={state}
      />
    </div>
  )
}

interface ColumnHeadOpenProps {
  column: Column
}

function ColumnHeadOpen({ column }: ColumnHeadOpenProps) {
  const {
    actions: { activatePackagesMetaFilter, activatePackagesFilter },
  } = SearchUIModel.use(SearchUIModel.ResultType.QuiltPackage)
  const {
    filterActions: { open },
  } = useContext()
  const showFilter = React.useCallback(() => {
    switch (column.tag) {
      case ColumnTag.UserMeta:
        activatePackagesMetaFilter(column.filter, column.predicateType)
        break
      case ColumnTag.SystemMeta:
        activatePackagesFilter(column.filter)
        break
    }
    open(column)
  }, [column, activatePackagesMetaFilter, activatePackagesFilter, open])
  return (
    <M.IconButton
      size="small"
      color={column.state.filtered ? 'primary' : 'inherit'}
      onClick={showFilter}
    >
      <M.Icon color="inherit" fontSize="inherit">
        filter_list
      </M.Icon>
    </M.IconButton>
  )
}

interface ColumnHeadHideProps {
  column: Column
}

function ColumnHeadHide({ column }: ColumnHeadHideProps) {
  const {
    actions: { deactivatePackagesFilter, deactivatePackagesMetaFilter, setBuckets },
  } = SearchUIModel.use(SearchUIModel.ResultType.QuiltPackage)
  const {
    columnsActions: { hide },
  } = useContext()
  const handleHide = React.useCallback(() => {
    if (column.state.filtered) {
      hide(column.filter)
      return
    }
    switch (column.tag) {
      case ColumnTag.SystemMeta:
        if (column.filter === 'name') {
          hide(column.filter)
        }
        deactivatePackagesFilter(column.filter)
        break
      case ColumnTag.UserMeta:
        if (column.state.inferred) {
          hide(column.filter)
        }
        deactivatePackagesMetaFilter(column.filter)
        break
      case ColumnTag.Bucket:
        setBuckets([])
        break
      default:
        assertNever(column)
    }
  }, [column, hide, deactivatePackagesFilter, deactivatePackagesMetaFilter, setBuckets])
  return (
    <M.IconButton size="small" color="inherit" onClick={handleHide}>
      <IconVisibilityOffOutlined color="inherit" fontSize="inherit" />
    </M.IconButton>
  )
}

const useColumnHeadStyles = M.makeStyles((t) => ({
  root: {
    display: 'flex',
    alignItems: 'center',
    position: 'relative',
    '&:hover $actions': {
      color: t.palette.text.secondary,
    },
  },
  actions: {
    color: t.palette.text.hint,
    transition: t.transitions.create('color'),
    marginLeft: t.spacing(1),
    display: 'grid',
    gridAutoFlow: 'column',
    gridColumnGap: '2px',
  },
  title: {
    ...t.typography.subtitle1,
    fontWeight: 500,
  },
}))

interface ColumnHeadProps {
  column: Column
  single: boolean
}

function ColumnHead({ column, single }: ColumnHeadProps) {
  const classes = useColumnHeadStyles()
  // FIXME: let hiding bucket column
  return (
    <div className={classes.root}>
      <p className={classes.title}>
        <M.Tooltip
          arrow
          title={column.tag === ColumnTag.SystemMeta ? column.fullTitle : ''}
        >
          <span>{column.title}</span>
        </M.Tooltip>
      </p>
      <div className={classes.actions}>
        <ColumnHeadOpen column={column} />
        {!single && column.tag !== ColumnTag.Bucket && <ColumnHeadHide column={column} />}
      </div>
    </div>
  )
}

const useLayoutStyles = M.makeStyles((t) => ({
  root: {
    position: 'relative',
  },
  scrollWrapper: {
    overflow: 'hidden',
  },
  scrollArea: {
    minHeight: t.spacing(70),
    overflowX: 'auto',
  },
  cell: {
    whiteSpace: 'nowrap',
  },
  placeholder: {
    width: t.spacing(5),
  },
}))

interface LayoutProps {
  hits: readonly SearchUIModel.SearchHitPackage[]
  columns: ColumnsMap
  skeletons: ReturnType<typeof Skeleton.useColumns>
  metaFiltersState: SearchUIModel.AvailableFiltersStateInstance
}

function Layout({ hits, columns, skeletons, metaFiltersState }: LayoutProps) {
  const classes = useLayoutStyles()
  const {
    filter,
    filterActions: { close },
  } = useContext()

  const visibleColumns = Array.from(columns.values()).filter((c) => c.state.visible)
  const [skeletonHead, ...skeletonColumns] = skeletons

  return (
    <M.Paper className={classes.root}>
      <ConfigureColumns columns={columns} state={metaFiltersState} />

      <div className={classes.scrollWrapper}>
        <div className={classes.scrollArea}>
          <M.Table size="small">
            <M.TableHead>
              <M.TableRow>
                <M.TableCell padding="checkbox" />
                {visibleColumns.map((column) => (
                  <M.TableCell className={classes.cell} key={column.filter}>
                    <ColumnHead column={column} single={visibleColumns.length === 1} />
                  </M.TableCell>
                ))}
                {skeletonHead?.columns.map(({ key, width }) => (
                  <Skeleton.Head key={key} width={width} />
                ))}
                <M.TableCell className={classes.placeholder} />
              </M.TableRow>
            </M.TableHead>
            <M.TableBody>
              {hits.map((hit, index) => (
                <PackageRow
                  key={hit.id}
                  columns={columns}
                  hit={hit}
                  skeletons={skeletonColumns[index + 1]?.columns}
                />
              ))}
            </M.TableBody>
          </M.Table>
        </div>
      </div>

      <M.Dialog open={!!filter} onClose={close} maxWidth="sm" fullWidth scroll="body">
        {filter && <FilterDialog column={filter} onClose={close} />}
      </M.Dialog>
    </M.Paper>
  )
}

const useTableViewStyles = M.makeStyles((t) => ({
  error: {
    marginBottom: t.spacing(2),
  },
}))

interface TableViewProps {
  hits: readonly SearchUIModel.SearchHitPackage[]
  bucket?: string
  metaFiltersState: SearchUIModel.AvailableFiltersStateInstance
}

function TableView({ hits, bucket, metaFiltersState }: TableViewProps) {
  const { hiddenColumns } = useContext()
  const [columns, notReady] = useColumns(hiddenColumns, metaFiltersState, bucket)
  const skeletons = Skeleton.useColumns(
    notReady === Workflow.Loading ? hits.length + 1 : 0,
    3,
  )
  const classes = useTableViewStyles()
  return (
    <>
      {notReady instanceof Error && (
        <Lab.Alert className={classes.error} severity="error">
          {notReady.message}
        </Lab.Alert>
      )}
      <Layout
        columns={columns}
        hits={hits}
        skeletons={skeletons}
        metaFiltersState={metaFiltersState}
      />
    </>
  )
}

interface TableViewInitProps {
  hits: readonly SearchUIModel.SearchHitPackage[]
  bucket?: string
}

export default function TableViewInit({ hits, bucket }: TableViewInitProps) {
  return (
    <Provider>
      <SearchUIModel.AvailablePackagesMetaFilters>
        {(metaFiltersState) => (
          <TableView hits={hits} bucket={bucket} metaFiltersState={metaFiltersState} />
        )}
      </SearchUIModel.AvailablePackagesMetaFilters>
    </Provider>
  )
}
