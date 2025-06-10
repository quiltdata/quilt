import { extname, join } from 'path'

import cx from 'classnames'
import jsonpath from 'jsonpath'
import * as React from 'react'
import * as M from '@material-ui/core'

import JsonDisplay from 'components/JsonDisplay'
import * as JSONPointer from 'utils/JSONPointer'
import { Leaf } from 'utils/KeyedTree'
import * as NamedRoutes from 'utils/NamedRoutes'
import StyledLink from 'utils/StyledLink'
import StyledTooltip from 'utils/StyledTooltip'
import assertNever from 'utils/assertNever'
import * as Format from 'utils/format'
import { readableBytes } from 'utils/string'
import type { Json, JsonRecord } from 'utils/types'

import type {
  SearchHitPackageMatchingEntry,
  SearchHitPackageWithMatches,
} from '../fakeMatchingEntries'
import { PACKAGES_FILTERS_PRIMARY, PACKAGES_FILTERS_SECONDARY } from '../constants'
import { columnLabels, packageFilterLabels } from '../i18n'
import * as SearchUIModel from '../model'

const useNoValueStyles = M.makeStyles((t) => ({
  root: {
    display: 'inline-block',
    width: t.spacing(2),
  },
}))

function NoValue() {
  const classes = useNoValueStyles()
  return (
    <div className={classes.root}>
      <M.Divider />
    </div>
  )
}

const isJsonRecord = (obj: Json): obj is JsonRecord =>
  obj != null && typeof obj === 'object' && !Array.isArray(obj)

const useTableViewSystemMetaStyles = M.makeStyles((t) => ({
  match: {
    background: t.palette.warning.light,
    padding: t.spacing(0.25, 0.5),
    margin: t.spacing(0, -0.5),
  },
}))

interface TableViewSystemMetaProps {
  hit: SearchHitPackageWithMatches
  filter: SearchUIModel.FilterStateForResultType<SearchUIModel.ResultType.QuiltPackage>['order'][number]
}

function TableViewSystemMeta({ hit, filter }: TableViewSystemMetaProps) {
  const classes = useTableViewSystemMetaStyles()
  const { urls } = NamedRoutes.use()
  const handleUnfold = React.useCallback(() => {}, [])

  switch (filter) {
    case 'workflow':
      return hit.workflow ? (
        <span className={cx(hit.matchLocations.workflow && classes.match)}>
          {hit.workflow.id}
          {Array.isArray(hit.workflow.schemas) &&
            hit.workflow.schemas.map((schema) => (
              <StyledTooltip title={`Use keywords from ${schema.id}`} key={schema.id}>
                <M.IconButton
                  size="small"
                  style={{ transform: 'rotate(90deg)', marginLeft: '16px' }}
                  onClick={handleUnfold}
                >
                  <M.Icon fontSize="inherit">unfold_more</M.Icon>
                </M.IconButton>
              </StyledTooltip>
            ))}
        </span>
      ) : (
        <NoValue />
      )
    case 'hash':
      return (
        <StyledLink to={urls.bucketFile(hit.bucket, join('.quilt/packages', hit.hash))}>
          {hit.hash}
        </StyledLink>
      )
    case 'size':
      return readableBytes(hit.size)
    case 'name':
      return (
        <StyledLink
          to={urls.bucketPackageTree(hit.bucket, hit.name, hit.hash)}
          className={cx(hit.matchLocations.name && classes.match)}
        >
          {hit.name}
        </StyledLink>
      )
    case 'comment':
      return hit.comment ? (
        <StyledTooltip title={hit.comment} placement="bottom-start">
          <span className={cx(hit.matchLocations.comment && classes.match)}>
            {hit.comment}
          </span>
        </StyledTooltip>
      ) : (
        <NoValue />
      )
    case 'modified':
      return <Format.Relative value={hit.modified} />
    default:
      return null
  }
}

interface TableViewUserMetaProps {
  meta: JsonRecord
  pointer: JSONPointer.Pointer
}

function TableViewUserMeta({ meta, pointer }: TableViewUserMetaProps) {
  if (!isJsonRecord(meta))
    return (
      <M.Tooltip title={`${meta}`}>
        <M.Icon color="disabled" fontSize="small" style={{ verticalAlign: 'middle' }}>
          error_outline
        </M.Icon>
      </M.Tooltip>
    )
  const value = jsonpath.value(meta, JSONPointer.toJsonPath(pointer))
  return value || <NoValue />
}

const useEntriesStyles = M.makeStyles((t) => ({
  root: {
    borderBottom: `1px solid ${t.palette.divider}`,
    padding: t.spacing(2, 7),
    background: t.palette.background.default,
    position: 'relative',
    width: '896px',
  },
  cell: {
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
    overflow: 'hidden',
  },
  noMeta: {
    width: t.spacing(1.5),
  },
  row: {
    '&:last-child $cell': {
      borderBottom: 0,
    },
  },
  table: {
    tableLayout: 'fixed',
  },
  popover: {
    position: 'absolute',
    top: '100%',
    trasform: 'translateY(1px)',
    left: 0,
    right: 0,
    zIndex: 1,
  },
  preview: {
    padding: t.spacing(3, 7),
  },
  content: {
    display: 'inline-block',
    background: t.palette.background.paper,
    borderRadius: t.shape.borderRadius,
    fontVariant: 'small-caps',
    padding: t.spacing(0.25, 0.5),
    fontWeight: t.typography.fontWeightMedium,
    margin: t.spacing(0, -0.5),
  },
  match: {
    background: t.palette.warning.light,
    padding: t.spacing(0.25, 0.5),
    margin: t.spacing(0, -0.5),
  },
  matchButton: {
    background: t.palette.warning.light,
  },
}))

interface EntriesProps {
  entries: readonly SearchHitPackageMatchingEntry[]
}

function Entries({ entries }: EntriesProps) {
  const classes = useEntriesStyles()

  const [previewEntry, setPreviewEntry] =
    React.useState<SearchHitPackageMatchingEntry | null>(null)
  const handleMouseEnter = React.useCallback((e: SearchHitPackageMatchingEntry) => {
    setPreviewEntry(e)
  }, [])
  const handleMouseLeave = React.useCallback(() => {
    setPreviewEntry(null)
  }, [])

  return (
    <M.Paper square className={classes.root} elevation={0}>
      <M.Table size="small" className={classes.table}>
        <M.TableHead>
          <M.TableRow>
            <M.TableCell className={classes.cell}>Logical Key</M.TableCell>
            <M.TableCell className={classes.cell}>Physical Key</M.TableCell>
            <M.TableCell className={classes.cell} align="right" width="80px">
              Size
            </M.TableCell>
            <M.TableCell className={classes.cell} align="center" width="120px">
              Meta
            </M.TableCell>
            <M.TableCell className={classes.cell} align="center" width="90px">
              Contents
            </M.TableCell>
          </M.TableRow>
        </M.TableHead>
        <M.TableBody>
          {entries.map((e) => (
            <M.TableRow hover key={e.physicalKey} className={classes.row}>
              <M.TableCell className={classes.cell} component="th" scope="row">
                <M.Tooltip title={e.logicalKey}>
                  <span className={cx(e.matchLocations.logicalKey && classes.match)}>
                    {e.logicalKey}
                  </span>
                </M.Tooltip>
              </M.TableCell>
              <M.TableCell className={classes.cell}>
                <M.Tooltip title={e.physicalKey}>
                  <span className={cx(e.matchLocations.physicalKey && classes.match)}>
                    {e.physicalKey}
                  </span>
                </M.Tooltip>
              </M.TableCell>
              <M.TableCell className={classes.cell} align="right">
                {readableBytes(e.size)}
              </M.TableCell>
              <M.TableCell className={classes.cell} align="center">
                {e.meta ? (
                  <M.IconButton
                    size="small"
                    className={cx(e.matchLocations.meta && classes.matchButton)}
                    onMouseEnter={() => handleMouseEnter(e)}
                    onMouseLeave={handleMouseLeave}
                  >
                    <M.Icon fontSize="inherit">list</M.Icon>
                  </M.IconButton>
                ) : (
                  <M.IconButton size="small" disabled>
                    <M.Divider className={classes.noMeta} />
                  </M.IconButton>
                )}
              </M.TableCell>
              <M.TableCell className={classes.cell} align="center">
                <span
                  className={cx(
                    classes.content,
                    e.matchLocations.contents && classes.match,
                  )}
                  onMouseEnter={() => handleMouseEnter(e)}
                  onMouseLeave={handleMouseLeave}
                >
                  {extname(e.logicalKey).substring(1)}
                </span>
              </M.TableCell>
            </M.TableRow>
          ))}
        </M.TableBody>
      </M.Table>
      {previewEntry && (
        <M.Paper square className={classes.popover} elevation={4}>
          <div className={classes.preview}>
            <JsonDisplay value={previewEntry.meta} defaultExpanded />
          </div>
        </M.Paper>
      )}
    </M.Paper>
  )
}

const useTableViewPackageStyles = M.makeStyles((t) => ({
  root: {
    '&:hover $fold': {
      opacity: 1,
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
    '&:last-child': {
      padding: 0,
    },
  },
  fold: {
    opacity: 0.3,
    transition: t.transitions.create(['opacity', 'transform']),
  },
  rotate: {
    transform: 'rotate(180deg)',
  },
}))

interface TableViewPackageProps {
  hit: SearchHitPackageWithMatches
  columns: (ColumnHeadFilter | ColumnHeadMeta)[]
}

function TableViewPackage({ columns, hit }: TableViewPackageProps) {
  const { state } = SearchUIModel.use(SearchUIModel.ResultType.QuiltPackage)
  const meta = hit.meta ? JSON.parse(hit.meta) : {}
  const classes = useTableViewPackageStyles()
  const [open, setOpen] = React.useState(false)
  const toggle = React.useCallback(() => setOpen((x) => !x), [])
  const colSpan = 2 + state.filter.order.length + state.userMetaFilters.filters.size

  return (
    <>
      <M.TableRow hover className={classes.root} onClick={toggle}>
        <M.TableCell padding="checkbox">
          {!!hit.matchingEntries?.length && (
            <M.IconButton
              size="small"
              className={cx(classes.fold, open && classes.rotate)}
            >
              <M.Icon>{open ? 'unfold_less' : 'unfold_more'}</M.Icon>
            </M.IconButton>
          )}
        </M.TableCell>
        {columns.map((column) =>
          column.tag === 'filter' ? (
            <M.TableCell
              className={classes.cell}
              data-search-hit-filter={column.filter}
              key={column.filter}
            >
              {!column.collapsed && (
                <TableViewSystemMeta hit={hit} filter={column.filter} />
              )}
            </M.TableCell>
          ) : (
            <M.TableCell
              className={classes.cell}
              data-search-hit-meta={column.filter}
              key={column.filter}
            >
              {!column.collapsed && (
                <TableViewUserMeta meta={meta} pointer={column.filter} />
              )}
            </M.TableCell>
          ),
        )}
      </M.TableRow>
      {!!hit.matchingEntries?.length && (
        <M.TableRow>
          <M.TableCell className={classes.entries} colSpan={colSpan}>
            <M.Collapse in={open} timeout="auto" unmountOnExit>
              <Entries entries={hit.matchingEntries} />
            </M.Collapse>
          </M.TableCell>
        </M.TableRow>
      )}
    </>
  )
}

interface TableViewObjectProps {
  hit: SearchUIModel.SearchHitObject
}

function TableViewObject({ hit }: TableViewObjectProps) {
  return (
    <>
      <M.TableRow hover>
        <M.TableCell padding="checkbox" />
        <M.TableCell>{hit.key}</M.TableCell>
      </M.TableRow>
    </>
  )
}

interface TableViewHitProps {
  hit: SearchUIModel.SearchHit
  columns: (ColumnHeadFilter | ColumnHeadMeta)[]
}

function TableViewHit({ columns, hit }: TableViewHitProps) {
  switch (hit.__typename) {
    case 'SearchHitObject':
      return <TableViewObject hit={hit} />
    case 'SearchHitPackage':
      return (
        <TableViewPackage columns={columns} hit={hit as SearchHitPackageWithMatches} />
      )
    default:
      assertNever(hit)
  }
}

const useColumnActionStyles = M.makeStyles((t) => ({
  root: {
    width: t.spacing(3),
    height: t.spacing(3),
  },
  icon: {
    fontSize: '20px',
  },
}))

interface ColumnActionProps {
  className?: string
  icon: string
  onClick?: () => void
}

function ColumnAction({ className, icon, onClick }: ColumnActionProps) {
  const classes = useColumnActionStyles()
  return (
    <M.IconButton className={cx(classes.root, className)} size="small" onClick={onClick}>
      <M.Icon className={classes.icon}>{icon}</M.Icon>
    </M.IconButton>
  )
}

const useColumnActionsStyles = M.makeStyles((t) => ({
  root: {
    display: 'grid',
    gridAutoFlow: 'column',
    gridColumnGap: t.spacing(1),
  },
}))

interface ColumnActionsProps {
  className: string
  column: ColumnHeadFilter | ColumnHeadMeta
}

function ColumnActions({ className, column }: ColumnActionsProps) {
  const classes = useColumnActionsStyles()
  return (
    <div className={cx(classes.root, className)}>
      {
        // FIXME: enable search and sort
        // <ColumnAction onClick={onSearch} icon="search" />
        // <ColumnAction onClick={onSort} icon="sort" />
      }
      <ColumnAction
        onClick={column.onCollapse}
        icon={column.collapsed ? 'visibility_off' : 'visibility'}
      />
      {column.onClose && <ColumnAction onClick={column.onClose} icon="close" />}
    </div>
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
        return { primary: rest }
      case 'type':
        return { primary: rest, secondary: 'Type' }
      default:
        return { primary: key }
    }
  }

  const [expanded, setExpanded] = React.useState(false)
  const toggleExpanded = React.useCallback(() => setExpanded((x) => !x), [])

  const model = SearchUIModel.use(SearchUIModel.ResultType.QuiltPackage)
  const { activatePackagesMetaFilter } = model.actions
  const activate = React.useCallback(
    (node: Leaf<SearchUIModel.PackageUserMetaFacet>) => {
      const type = SearchUIModel.PackageUserMetaFacetMap[node.value.__typename]
      activatePackagesMetaFilter(node.value.path, type)
    },
    [activatePackagesMetaFilter],
  )

  return (
    <li className={cx(classes.root)}>
      <ul className={classes.auxList}>
        {!!path && (
          <M.ListItem disabled={disabled} button onClick={toggleExpanded}>
            <M.ListItemText primary={getLabel(path).primary} />
            <M.ListItemIcon className={classes.iconWrapper}>
              <M.Icon className={cx(classes.icon)}>
                {expanded ? 'expand_less' : 'expand_more'}
              </M.Icon>
            </M.ListItemIcon>
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
                <M.MenuItem key={path + p} onClick={() => activate(node)}>
                  <M.ListItemText {...getLabel(p)} />
                </M.MenuItem>
              ),
            )}
          </M.Collapse>
        </div>
      </ul>
    </li>
  )
}

const useAddColumnStyles = M.makeStyles((t) => ({
  root: {
    background: t.palette.background.default,
    bottom: 0,
    boxShadow: t.shadows[2],
    display: 'flex',
    flexDirection: 'column',
    position: 'absolute',
    right: 0,
    top: 0,
    transition: t.transitions.create('width'),
    width: t.spacing(4),
  },
  add: {
    lineHeight: `${t.spacing(3)}px`,
    padding: t.spacing(0, 2),
  },
  head: {
    display: 'flex',
    justifyContent: 'center',
    padding: '6px 0',
    borderBottom: `1px solid ${t.palette.divider}`,
  },
  button: {
    transition: t.transitions.create('opacity'),
    opacity: 0.3,
  },
  opened: {
    width: 'auto',
    animation: t.transitions.create('$slide'),
    '& $head': {
      justifyContent: 'flex-start',
    },
  },
  list: {
    animation: t.transitions.create('$fade'),
    background: t.palette.background.paper,
    overflowY: 'auto',
  },
  listInner: {
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
  '@keyframes slide': {
    '0%': {
      transform: `translateX(${t.spacing(16)}px)`,
    },
    '100%': {
      transform: 'translateX(0)',
    },
  },
}))

interface AddColumnProps {
  columns: (ColumnHeadMeta | ColumnHeadFilter)[]
}

function AddColumn({ columns }: AddColumnProps) {
  const [open, setOpen] = React.useState(false)
  const classes = useAddColumnStyles()
  const model = SearchUIModel.use(SearchUIModel.ResultType.QuiltPackage)
  const { predicates } = model.state.filter
  const { activatePackagesFilter } = model.actions

  const availableFilters = [...PACKAGES_FILTERS_PRIMARY, ...PACKAGES_FILTERS_SECONDARY]
    .filter((f) => !predicates[f])
    .filter((f) => f !== 'name')

  const handleFilter = React.useCallback(
    (filter: (typeof availableFilters)[number]) => {
      setOpen(false)
      activatePackagesFilter(filter)
    },
    [activatePackagesFilter],
  )

  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleMouseEnter = React.useCallback(() => {
    timeoutRef.current = setTimeout(() => setOpen(true), 100)
  }, [])

  const handleMouseLeave = React.useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    setOpen(false)
  }, [])

  const hiddenColumns = columns.filter((column) => column.collapsed)

  return (
    <div
      className={cx(classes.root, { [classes.opened]: open })}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className={classes.head}>
        {open ? (
          <M.Typography variant="subtitle2" className={classes.add}>
            Add column:
          </M.Typography>
        ) : (
          <ColumnAction className={classes.button} icon="add" />
        )}
      </div>
      {open && (
        <div className={classes.list}>
          <M.List className={classes.listInner} dense>
            {!!hiddenColumns.length && (
              <>
                <M.ListSubheader>Hidden columns</M.ListSubheader>
                {hiddenColumns.map((column) => (
                  <M.MenuItem key={column.filter} onClick={column.onCollapse}>
                    <M.ListItemIcon>
                      <M.Icon color="disabled">visibility_off</M.Icon>
                    </M.ListItemIcon>
                    <M.ListItemText primary={column.title} />
                  </M.MenuItem>
                ))}
              </>
            )}
            <M.ListSubheader>System metadata</M.ListSubheader>
            {availableFilters.map((filter) => (
              <M.MenuItem key={filter} onClick={() => handleFilter(filter)}>
                <M.ListItemText primary={packageFilterLabels[filter]} />
              </M.MenuItem>
            ))}
            <M.ListSubheader>User metadata</M.ListSubheader>
            <SearchUIModel.AvailablePackagesMetaFilters>
              {SearchUIModel.AvailableFiltersState.match({
                Loading: () => <M.Typography>Analyzing metadata&hellip;</M.Typography>,
                Empty: () => null,
                Ready: ({ facets }) => (
                  <>
                    <FilterGroup items={facets.visible.children} />
                    <FilterGroup items={facets.hidden.children} />
                  </>
                ),
              })}
            </SearchUIModel.AvailablePackagesMetaFilters>
          </M.List>
        </div>
      )}
    </div>
  )
}

const noopFixme = () => {}

const useTableViewStyles = M.makeStyles((t) => ({
  root: {
    overflow: 'hidden',
    position: 'relative',
    '& th:last-child $head::after': {
      display: 'none',
    },
  },
  scrollArea: {
    paddingRight: t.spacing(4),
    overflowX: 'auto',
  },
  cell: {
    whiteSpace: 'nowrap',
  },
  head: {
    display: 'flex',
    alignItems: 'center',
    position: 'relative',
    '&::after': {
      content: '""',
      position: 'absolute',
      right: t.spacing(-3),
      top: t.spacing(1),
      bottom: t.spacing(1),
      background: t.palette.divider,
      width: '1px',
    },
    '&:hover $headActions': {
      opacity: 1,
    },
  },
  headActions: {
    opacity: 0.3,
    transition: t.transitions.create('opacity'),
    marginLeft: t.spacing(2),
  },
  headIcon: {
    color: t.palette.text.secondary,
    marginRight: t.spacing(1),
  },
}))

interface ColumnHeadBase {
  onSearch: () => void
  onSort: () => void
  onClose?: () => void
  onCollapse: () => void
  collapsed: boolean
}

interface ColumnHeadFilter extends ColumnHeadBase {
  tag: 'filter'
  filter: SearchUIModel.FilterStateForResultType<SearchUIModel.ResultType.QuiltPackage>['order'][number]
  title: string
  fullTitle: string
}

interface ColumnHeadMeta extends ColumnHeadBase {
  tag: 'meta'
  filter: string
  title: string
}

export interface TableViewProps {
  hits: readonly SearchHitPackageWithMatches[]
}

export default function TableView({ hits }: TableViewProps) {
  const { actions, state } = SearchUIModel.use(SearchUIModel.ResultType.QuiltPackage)
  const classes = useTableViewStyles()

  const [collapsed, setCollapsed] = React.useState<
    Record<ColumnHeadFilter['filter'] | ColumnHeadMeta['filter'], boolean>
  >({})
  const columns: (ColumnHeadFilter | ColumnHeadMeta)[] = React.useMemo(
    () => [
      {
        tag: 'filter' as const,
        filter: 'name' as const,
        title: columnLabels.name,
        fullTitle: packageFilterLabels.name,
        onSearch: noopFixme,
        onSort: noopFixme,
        collapsed: !!collapsed.name,
        onCollapse: () => setCollapsed((x) => ({ ...x, name: !x.name })),
      },
      ...state.filter.order
        // We don't have a value for number of entries
        .filter((filter) => filter !== 'entries')
        .map((filter) => ({
          tag: 'filter' as const,
          filter,
          title: columnLabels[filter],
          fullTitle: packageFilterLabels[filter],
          onSearch: noopFixme,
          onSort: noopFixme,
          onClose: () => actions.deactivatePackagesFilter(filter),
          collapsed: !!collapsed[filter],
          onCollapse: () => setCollapsed((x) => ({ ...x, [filter]: !x[filter] })),
        })),
      ...Array.from(state.userMetaFilters.filters.keys()).map((filter) => ({
        tag: 'meta' as const,
        filter,
        title: filter.replace(/^\//, ''),
        onSearch: noopFixme,
        onSort: noopFixme,
        onClose: () => actions.deactivatePackagesMetaFilter(filter),
        collapsed: !!collapsed[filter],
        onCollapse: () => setCollapsed((x) => ({ ...x, [filter]: !x[filter] })),
      })),
    ],
    [actions, collapsed, state.filter, state.userMetaFilters],
  )
  const shownColumns = React.useMemo(() => columns.filter((c) => !c.collapsed), [columns])
  return (
    <M.Paper className={classes.root}>
      <div className={classes.scrollArea}>
        <M.Table size="small">
          <M.TableHead>
            <M.TableRow>
              <M.TableCell padding="checkbox" />
              {shownColumns.map((column) => (
                <M.TableCell className={classes.cell} key={column.filter}>
                  <div className={classes.head}>
                    {column.tag === 'filter' ? (
                      <M.Tooltip title={column.fullTitle}>
                        <span>{column.title}</span>
                      </M.Tooltip>
                    ) : (
                      <>
                        <M.Icon className={classes.headIcon} fontSize="small">
                          list
                        </M.Icon>
                        {column.title}
                      </>
                    )}
                    <ColumnActions className={classes.headActions} column={column} />
                  </div>
                </M.TableCell>
              ))}
            </M.TableRow>
          </M.TableHead>
          <M.TableBody>
            {hits.map((hit) => (
              <TableViewHit key={hit.id} hit={hit} columns={shownColumns} />
            ))}
          </M.TableBody>
        </M.Table>
      </div>
      <AddColumn columns={columns} />
    </M.Paper>
  )
}
