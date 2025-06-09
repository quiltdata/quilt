import { extname } from 'path'

import cx from 'classnames'
import jsonpath from 'jsonpath'
import * as React from 'react'
import * as RR from 'react-router-dom'
import * as M from '@material-ui/core'

import JsonDisplay from 'components/JsonDisplay'
import * as JSONPointer from 'utils/JSONPointer'
import { Leaf } from 'utils/KeyedTree'
import * as NamedRoutes from 'utils/NamedRoutes'
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

const NoValue = () => (
  <M.Box display="inline-block" width={16}>
    <M.Divider />
  </M.Box>
)

const isJsonRecord = (obj: Json): obj is JsonRecord =>
  obj != null && typeof obj === 'object' && !Array.isArray(obj)

interface TableViewSystemMetaProps {
  hit: SearchUIModel.SearchHitPackage
  filter: SearchUIModel.FilterStateForResultType<SearchUIModel.ResultType.QuiltPackage>['order'][number]
}

function TableViewSystemMeta({ hit, filter }: TableViewSystemMetaProps) {
  switch (filter) {
    case 'workflow':
      return hit.workflow ? hit.workflow.id : <NoValue />
    case 'size':
      return readableBytes(hit.size)
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

const useMatchingEntriesTableStyles = M.makeStyles((t) => ({
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

interface MatchingEntriesTableProps {
  entries: readonly SearchHitPackageMatchingEntry[]
}

function MatchingEntriesTable({ entries }: MatchingEntriesTableProps) {
  const classes = useMatchingEntriesTableStyles()

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
    '&:hover $navIcon': {
      opacity: 1,
    },
  },
  cell: {
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
  navIcon: {
    display: 'inline-block',
    marginLeft: t.spacing(0.5),
    opacity: 0,
    transition: t.transitions.create(['transform', 'opacity']),
    verticalAlign: 'bottom',
  },
  link: {
    '&:hover $navIcon': {
      transform: `translateX(${t.spacing(0.5)}px)`,
    },
  },
}))

interface TableViewPackageProps {
  hit: SearchHitPackageWithMatches
}

function TableViewPackage({ hit }: TableViewPackageProps) {
  const { state } = SearchUIModel.use(SearchUIModel.ResultType.QuiltPackage)
  const meta = hit.meta ? JSON.parse(hit.meta) : {}
  const classes = useTableViewPackageStyles()
  const { urls } = NamedRoutes.use()
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
        <M.TableCell className={classes.cell}>
          <RR.Link
            to={urls.bucketPackageTree(hit.bucket, hit.name, hit.hash)}
            className={classes.link}
          >
            {hit.name}
            <M.Icon fontSize="small" className={classes.navIcon}>
              navigate_next
            </M.Icon>
          </RR.Link>
        </M.TableCell>
        {state.filter.order.map((filter) => (
          <M.TableCell
            className={classes.cell}
            data-search-hit-filter={filter}
            key={filter}
          >
            <TableViewSystemMeta hit={hit} filter={filter} />
          </M.TableCell>
        ))}
        {Array.from(state.userMetaFilters.filters.keys()).map((key) => (
          <M.TableCell className={classes.cell} data-search-hit-meta={key} key={key}>
            <TableViewUserMeta meta={meta} pointer={key} />
          </M.TableCell>
        ))}
      </M.TableRow>
      {!!hit.matchingEntries?.length && (
        <M.TableRow>
          <M.TableCell className={classes.entries} colSpan={colSpan}>
            <M.Collapse in={open} timeout="auto" unmountOnExit>
              <MatchingEntriesTable entries={hit.matchingEntries} />
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
}

function TableViewHit({ hit }: TableViewHitProps) {
  switch (hit.__typename) {
    case 'SearchHitObject':
      return <TableViewObject hit={hit} />
    case 'SearchHitPackage':
      return <TableViewPackage hit={hit as SearchHitPackageWithMatches} />
    default:
      assertNever(hit)
  }
}

const useColumnActionStyles = M.makeStyles((t) => ({
  root: {
    width: t.spacing(4),
    height: t.spacing(4),
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
  onSearch: () => void
  onSort: () => void
  onClose?: () => void
}

function ColumnActions({ className, onSearch, onSort, onClose }: ColumnActionsProps) {
  const classes = useColumnActionsStyles()
  return (
    <div className={cx(classes.root, className)}>
      <ColumnAction onClick={onSearch} icon="search" />
      <ColumnAction onClick={onSort} icon="sort" />
      {onClose && <ColumnAction onClick={onClose} icon="close" />}
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
    lineHeight: `${t.spacing(4)}px`,
    padding: t.spacing(0, 2),
  },
  head: {
    display: 'flex',
    justifyContent: 'center',
    padding: t.spacing(0.75, 0),
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

interface AddColumnProps {}

function AddColumn({}: AddColumnProps) {
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
          <M.List className={classes.listInner}>
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
}))

export interface TableViewProps {
  hits: readonly SearchUIModel.SearchHit[]
}

export default function TableView({ hits }: TableViewProps) {
  const { actions, state } = SearchUIModel.use(SearchUIModel.ResultType.QuiltPackage)
  const classes = useTableViewStyles()
  return (
    <M.Paper className={classes.root}>
      <div className={classes.scrollArea}>
        <M.Table size="small">
          <M.TableHead>
            <M.TableRow>
              <M.TableCell padding="checkbox" />
              <M.TableCell className={classes.cell}>
                <div className={classes.head}>
                  Name
                  <ColumnActions
                    className={classes.headActions}
                    onSearch={noopFixme}
                    onSort={noopFixme}
                  />
                </div>
              </M.TableCell>
              {state.filter.order.map((filter) => (
                <M.TableCell key={filter} className={classes.cell}>
                  <div className={classes.head}>
                    <M.Tooltip title={packageFilterLabels[filter]}>
                      <span>{columnLabels[filter]}</span>
                    </M.Tooltip>
                    <ColumnActions
                      className={classes.headActions}
                      onSearch={noopFixme}
                      onSort={noopFixme}
                      onClose={() => actions.deactivatePackagesFilter(filter)}
                    />
                  </div>
                </M.TableCell>
              ))}
              {Array.from(state.userMetaFilters.filters.keys()).map((key) => (
                <M.TableCell key={key} className={classes.cell}>
                  <div className={classes.head}>
                    {key}
                    <ColumnActions
                      className={classes.headActions}
                      onSearch={noopFixme}
                      onSort={noopFixme}
                      onClose={() => actions.deactivatePackagesMetaFilter(key)}
                    />
                  </div>
                </M.TableCell>
              ))}
            </M.TableRow>
          </M.TableHead>
          <M.TableBody>
            {hits.map((hit) => (
              <TableViewHit key={hit.id} hit={hit} />
            ))}
          </M.TableBody>
        </M.Table>
      </div>
      <AddColumn />
    </M.Paper>
  )
}
