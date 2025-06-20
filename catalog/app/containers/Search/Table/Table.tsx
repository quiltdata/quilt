import { extname, join } from 'path'

import cx from 'classnames'
import invariant from 'invariant'
import jsonpath from 'jsonpath'
import * as React from 'react'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import * as Preview from 'components/Preview'
import JsonDisplay from 'components/JsonDisplay'
import * as Model from 'model'
import * as GQL from 'utils/GraphQL'
import * as JSONPointer from 'utils/JSONPointer'
import { Leaf } from 'utils/KeyedTree'
import * as NamedRoutes from 'utils/NamedRoutes'
import StyledLink from 'utils/StyledLink'
import StyledTooltip from 'utils/StyledTooltip'
import assertNever from 'utils/assertNever'
import * as Format from 'utils/format'
import * as s3paths from 'utils/s3paths'
import { readableBytes } from 'utils/string'
import type { Json, JsonRecord } from 'utils/types'

import FilterWidget from '../FilterWidget'
import { PACKAGES_FILTERS_PRIMARY, PACKAGES_FILTERS_SECONDARY } from '../constants'
import { COLUMN_LABELS, PACKAGE_FILTER_LABELS } from '../i18n'
import * as SearchUIModel from '../model'

import META_FACETS_QUERY from '../gql/PackageMetaFacets.generated'

import * as Workflow from './workflow'

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

type FilterType =
  SearchUIModel.FilterStateForResultType<SearchUIModel.ResultType.QuiltPackage>['order'][number]

interface TableViewSystemMetaProps {
  hit: SearchUIModel.SearchHitPackage
  filter: FilterType
}

function SystemMetaValue({ hit, filter }: TableViewSystemMetaProps) {
  const { urls } = NamedRoutes.use()
  switch (filter) {
    case 'workflow':
      return hit.workflow ? hit.workflow.id : <NoValue />
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
        <StyledLink to={urls.bucketPackageTree(hit.bucket, hit.name, hit.hash)}>
          {hit.name}
        </StyledLink>
      )
    case 'comment':
      return hit.comment ? (
        <StyledTooltip title={hit.comment} placement="bottom-start">
          <span>{hit.comment}</span>
        </StyledTooltip>
      ) : (
        <NoValue />
      )
    case 'modified':
      return <Format.Relative value={hit.modified} />
    case 'entries':
      return hit.totalEntriesCount
    default:
      assertNever(filter)
  }
}

interface TableViewUserMetaProps {
  meta: JsonRecord
  pointer: JSONPointer.Pointer
}

function UserMetaValue({ meta, pointer }: TableViewUserMetaProps) {
  const value = React.useMemo(() => {
    try {
      if (!isJsonRecord(meta)) return new Error('Meta must be object')
      return jsonpath.value(meta, JSONPointer.toJsonPath(pointer))
    } catch (err) {
      return err instanceof Error ? err : new Error(`${err}`)
    }
  }, [meta, pointer])

  if (value instanceof Error) {
    return (
      <M.Tooltip title={`${meta}`}>
        <M.Icon color="disabled" fontSize="small" style={{ verticalAlign: 'middle' }}>
          error_outline
        </M.Icon>
      </M.Tooltip>
    )
  }

  switch (typeof value) {
    case 'number':
    case 'string':
      return <>{value}</>
    case 'object':
      return <>{JSON.stringify(value)}</>
    default:
      return <NoValue />
  }
}

const useEntriesStyles = M.makeStyles((t) => ({
  root: {
    borderBottom: `1px solid ${t.palette.divider}`,
    background: t.palette.background.default,
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
    left: t.spacing(-0.5),
    right: t.spacing(-0.5),
    zIndex: 10,
    animation: t.transitions.create(['$growX']),
    '&::before': {
      background: M.fade(t.palette.common.black, 0.15),
      bottom: 0,
      content: '""',
      left: 0,
      position: 'fixed',
      right: 0,
      top: 0,
      zIndex: 20,
    },
  },
  preview: {
    padding: t.spacing(1.5, 3, 3),
    position: 'relative',
    zIndex: 30,
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
  sticky: {
    animation: t.transitions.create(['$fade', '$growDown']),
    // It is positioned where it would be without `absolute`,
    // but it continues to stay there when table is scrolled.
    position: 'absolute',
    padding: t.spacing(2, 2, 2, 7),
    // fullWidth
    //  - page container paddings
    //  - sidebar width
    //  - sidebar margin (grid gap)
    //  - "Add column" widget width
    width: `calc(100vw - ${t.spacing(3 * 2)}px - ${t.spacing(40)}px - ${t.spacing(2)}px - ${t.spacing(4)}px)`,
  },
  '@keyframes growDown': {
    '0%': {
      transform: 'translateY(-4px)',
    },
    '100%': {
      transform: 'translateY(0)',
    },
  },
  '@keyframes growX': {
    '0%': {
      left: 0,
      right: 0,
    },
    '100%': {
      left: t.spacing(-0.5),
      right: t.spacing(-0.5),
    },
  },
  '@keyframes fade': {
    '0%': {
      opacity: 0.3,
    },
    '100%': {
      opacity: 1,
    },
  },
  scrolling: {
    opacity: 0.3,
  },
  hide: {
    left: t.spacing(2),
    opacity: 0.3,
    position: 'absolute',
    top: t.spacing(3),
    transition: t.transitions.create('opacity'),
    '&:hover': {
      opacity: 1,
    },
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: t.spacing(2),
  },
  close: {
    margin: t.spacing(-1, -2),
  },
}))

interface PreviewEntry {
  type: 'meta' | 'content'
  entry: Omit<Model.GQLTypes.SearchHitPackageMatchingEntry, 'matchLocations'>
}

interface EntriesProps {
  entries: readonly Omit<Model.GQLTypes.SearchHitPackageMatchingEntry, 'matchLocations'>[]
  onClose: () => void
}

function Entries({ entries, onClose }: EntriesProps) {
  const classes = useEntriesStyles()
  const ref = React.useRef<HTMLDivElement>(null)
  const [height, setHeight] = React.useState('auto')

  const [preview, setPreview] = React.useState<PreviewEntry | null>(null)

  React.useEffect(() => {
    if (!ref.current) return
    setHeight(`${ref.current.clientHeight}px`)
  }, [entries])

  return (
    <div className={cx(classes.root)} style={{ height }}>
      <div className={classes.sticky} ref={ref}>
        <M.IconButton className={classes.hide} size="small" onClick={onClose}>
          <M.Icon fontSize="inherit">expand_less</M.Icon>
        </M.IconButton>
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
            {entries.map((entry) => (
              <M.TableRow hover key={entry.physicalKey} className={classes.row}>
                <M.TableCell className={classes.cell} component="th" scope="row">
                  <M.Tooltip title={entry.logicalKey}>
                    <span>{entry.logicalKey}</span>
                  </M.Tooltip>
                </M.TableCell>
                <M.TableCell className={classes.cell}>
                  <M.Tooltip title={entry.physicalKey}>
                    <span>{entry.physicalKey}</span>
                  </M.Tooltip>
                </M.TableCell>
                <M.TableCell className={classes.cell} align="right">
                  {readableBytes(entry.size)}
                </M.TableCell>
                <M.TableCell className={classes.cell} align="center">
                  {entry.meta ? (
                    <M.IconButton
                      size="small"
                      onClick={() => setPreview({ type: 'meta', entry })}
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
                    className={classes.content}
                    onClick={() => setPreview({ type: 'content', entry })}
                  >
                    {extname(entry.logicalKey).substring(1)}
                  </span>
                </M.TableCell>
              </M.TableRow>
            ))}
          </M.TableBody>
        </M.Table>
        {preview && (
          <div className={classes.popover}>
            <M.ClickAwayListener onClickAway={() => setPreview(null)}>
              <M.Paper square elevation={2} className={classes.preview}>
                <div className={classes.header}>
                  <M.Typography variant="h6">{preview.entry.logicalKey}</M.Typography>
                  <M.IconButton
                    className={classes.close}
                    onClick={() => setPreview(null)}
                  >
                    <M.Icon>close</M.Icon>
                  </M.IconButton>
                </div>

                {preview.type === 'meta' && (
                  <JsonDisplay value={preview.entry.meta} defaultExpanded />
                )}
                {preview.type === 'content' && (
                  <Preview.Load
                    handle={s3paths.parseS3Url(preview.entry.physicalKey)}
                    options={{ context: Preview.CONTEXT.LISTING }}
                  >
                    {(data: $TSFixMe) => (
                      <Preview.Display
                        data={data}
                        noDownload={undefined}
                        onData={undefined}
                        props={undefined} // these props go to the render functions
                      />
                    )}
                  </Preview.Load>
                )}
              </M.Paper>
            </M.ClickAwayListener>
          </div>
        )}
      </div>
    </div>
  )
}

const usePackageRowStyles = M.makeStyles((t) => ({
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
    verticalAlign: 'top',
    '&:last-child': {
      padding: 0,
    },
  },
  fold: {
    opacity: 0.3,
    transition: t.transitions.create(['opacity', 'transform', 'margin']),
  },
  rotate: {
    margin: t.spacing(2, 0),
    opacity: 1,
    transform: 'rotate(180deg)',
  },
}))

interface PackageRowProps {
  hit: SearchUIModel.SearchHitPackage
  columns: Column[]
}

function PackageRow({ columns, hit }: PackageRowProps) {
  const meta = hit.meta && typeof hit.meta === 'string' ? JSON.parse(hit.meta) : {}
  const classes = usePackageRowStyles()
  const [open, setOpen] = React.useState(false)
  const toggle = React.useCallback(() => setOpen((x) => !x), [])

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
        {columns.map((column) => {
          switch (column.tag) {
            case 'filter':
              return (
                <M.TableCell
                  className={classes.cell}
                  data-search-hit-filter={column.filter}
                  key={column.filter}
                >
                  <SystemMetaValue hit={hit} filter={column.filter} />
                </M.TableCell>
              )
            case 'meta':
              return (
                <M.TableCell
                  className={classes.cell}
                  data-search-hit-meta={column.filter}
                  key={column.filter}
                >
                  <UserMetaValue meta={meta} pointer={column.filter} />
                </M.TableCell>
              )
            case 'visual':
              return (
                <M.TableCell className={classes.cell} key={column.filter}>
                  {hit.bucket}
                </M.TableCell>
              )
          }
        })}
      </M.TableRow>
      {!!hit.matchingEntries?.length && (
        <M.TableRow>
          <M.TableCell className={classes.entries} colSpan={columns.length + 1}>
            {open && <Entries entries={hit.matchingEntries} onClose={toggle} />}
          </M.TableCell>
        </M.TableRow>
      )}
    </>
  )
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

interface ColumnActionProps extends M.IconButtonProps {
  className?: string
  icon: string
}

const ColumnAction = React.forwardRef<HTMLButtonElement, ColumnActionProps>(
  function ColumnAction({ className, icon, ...props }, ref) {
    const classes = useColumnActionStyles()
    return (
      <M.IconButton
        className={cx(classes.root, className)}
        ref={ref}
        size="small"
        color={props.color || 'inherit'}
        {...props}
      >
        <M.Icon color="inherit" className={classes.icon}>
          {icon}
        </M.Icon>
      </M.IconButton>
    )
  },
)

interface FilterProps {
  filter: keyof SearchUIModel.PackagesSearchFilter
  onClose: () => void
}

function Filter({ filter, onClose }: FilterProps) {
  const model = SearchUIModel.use(SearchUIModel.ResultType.QuiltPackage)
  const predicateState = model.state.filter.predicates[filter]
  invariant(predicateState, 'Filter not active')
  const extents = SearchUIModel.usePackageSystemMetaFacetExtents(filter)

  const change = React.useCallback(
    (state: $TSFixMe) => {
      model.actions.setPackagesFilter(filter, state)
      onClose()
    },
    [model.actions, filter, onClose],
  )
  return <FilterWidget state={predicateState} extents={extents} onChange={change} />
}

interface MetaFilterProps {
  path: string
  onClose: () => void
}

function MetaFilter({ path, onClose }: MetaFilterProps) {
  const model = SearchUIModel.use(SearchUIModel.ResultType.QuiltPackage)
  const predicateState = model.state.userMetaFilters.filters.get(path)
  invariant(predicateState, 'Filter not active')

  const { fetching, extents } = SearchUIModel.usePackageUserMetaFacetExtents(path)
  const change = React.useCallback(
    (state: SearchUIModel.PredicateState<SearchUIModel.KnownPredicate>) => {
      model.actions.setPackagesMetaFilter(path, state)
      onClose()
    },
    [model.actions, path, onClose],
  )
  return fetching ? (
    <M.Box display="grid" gridAutoFlow="row" gridRowGap={1}>
      <Lab.Skeleton height={32} />
      <Lab.Skeleton height={32} />
    </M.Box>
  ) : (
    <FilterWidget state={predicateState} extents={extents} onChange={change} />
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
  column: Column
}

function ColumnActions({ className, column }: ColumnActionsProps) {
  const classes = useColumnActionsStyles()
  const model = SearchUIModel.use(SearchUIModel.ResultType.QuiltPackage)

  const [menuOpened, setMenuOpened] = React.useState(false)
  const showMenu = React.useCallback(() => setMenuOpened(true), [])
  const hideMenu = React.useCallback(() => setMenuOpened(false), [])

  const [filterOpened, setFilterOpened] = React.useState(false)
  const showFilter = React.useCallback(() => {
    switch (column.tag) {
      case 'meta':
        model.actions.activatePackagesMetaFilter(column.filter, column.predicateType)
        break
      case 'filter':
        model.actions.activatePackagesFilter(column.filter)
        break
    }
    setFilterOpened(true)
  }, [column, model.actions])
  const hideFilter = React.useCallback(() => setFilterOpened(false), [])

  const [anchorEl, setAnchorEl] = React.useState<HTMLElement | null>(null)

  const handleHide = React.useCallback(() => {
    if (!column.filtered && column.onClose) {
      column.onClose()
    } else {
      column.onCollapse()
    }
  }, [column])

  const popoverProps: Partial<M.PopoverProps> = React.useMemo(() => {
    const onClose = () => {
      hideFilter()
      hideMenu()
    }
    return {
      anchorEl,
      onClose,
      anchorOrigin: {
        vertical: 'bottom',
        horizontal: 'left',
      },
      PaperProps: {
        onMouseLeave: onClose,
      },
    }
  }, [anchorEl, hideFilter, hideMenu])

  return (
    <div
      className={cx(classes.root, className)}
      ref={(el) => setAnchorEl(el?.parentElement || el)}
    >
      {
        // FIXME:
        // <ColumnAction onClick={onSort} icon="sort" />
      }
      <ColumnAction
        color={column.filtered ? 'primary' : 'inherit'}
        icon="filter_list"
        onClick={showFilter}
      />
      {column.filtered ? (
        <ColumnAction icon="close" onClick={showMenu} onMouseEnter={showMenu} />
      ) : (
        <StyledTooltip
          title={column.onClose ? 'Deactivate filter and hide column' : 'Hide column'}
        >
          <ColumnAction icon="close" onClick={handleHide} />
        </StyledTooltip>
      )}
      <M.Popover open={menuOpened} {...popoverProps}>
        <M.List dense>
          <M.ListItem button onClick={handleHide}>
            <M.ListItemIcon>
              <M.Icon>visibility</M.Icon>
            </M.ListItemIcon>
            <M.ListItemText primary="Hide column" />
          </M.ListItem>
          {column.filtered && (
            <M.ListItem button onClick={column.onClose}>
              <M.ListItemIcon>
                <M.Icon>undo</M.Icon>
              </M.ListItemIcon>
              <M.ListItemText primary="Reset filter" />
            </M.ListItem>
          )}
        </M.List>
      </M.Popover>
      <M.Popover open={filterOpened} {...popoverProps}>
        {column.tag === 'filter' && column.filter !== 'name' && (
          <M.Box display="flex" flexDirection="column" padding={2} width={320}>
            <Filter filter={column.filter} onClose={hideFilter} />
          </M.Box>
        )}
        {column.tag === 'meta' && (
          <M.Box display="flex" flexDirection="column" padding={2} width={320}>
            <MetaFilter path={column.filter} onClose={hideFilter} />
          </M.Box>
        )}
      </M.Popover>
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

const useAvailableFacetsStyles = M.makeStyles((t) => ({
  root: {
    animation: t.transitions.create('$fade'),
    background: t.palette.background.paper,
    overflowY: 'auto',
    flexGrow: 1,
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

interface AvailableFacetsProps {
  hidden: Column[]
  onClose: () => void
}

function AvailableFacets({ hidden, onClose }: AvailableFacetsProps) {
  const classes = useAvailableFacetsStyles()

  const model = SearchUIModel.use(SearchUIModel.ResultType.QuiltPackage)
  const { predicates } = model.state.filter
  const availableFilters = [...PACKAGES_FILTERS_PRIMARY, ...PACKAGES_FILTERS_SECONDARY]
    .filter((f) => !predicates[f])
    .filter((f) => f !== 'name')

  const { activatePackagesFilter } = model.actions
  const handleFilter = React.useCallback(
    (filter: (typeof availableFilters)[number]) => {
      activatePackagesFilter(filter)
      onClose()
    },
    [activatePackagesFilter, onClose],
  )

  return (
    <div className={classes.root}>
      <M.List className={classes.list} dense>
        {!!hidden.length && (
          <>
            <M.ListSubheader>Hidden columns</M.ListSubheader>
            {hidden.map((column) => (
              <M.MenuItem key={column.filter} onClick={column.onCollapse}>
                <M.ListItemIcon>
                  <M.Icon color="disabled">visibility_off</M.Icon>
                </M.ListItemIcon>
                <M.ListItemText primary={column.title} />
              </M.MenuItem>
            ))}
          </>
        )}
        {!!availableFilters.length && (
          <>
            <M.ListSubheader>System metadata</M.ListSubheader>
            {availableFilters.map((filter) => (
              <M.MenuItem key={filter} onClick={() => handleFilter(filter)}>
                <M.ListItemText primary={PACKAGE_FILTER_LABELS[filter]} />
              </M.MenuItem>
            ))}
          </>
        )}

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
    padding: t.spacing(0.75, 2),
  },
  head: {
    display: 'flex',
    justifyContent: 'center',
    borderBottom: `1px solid ${t.palette.divider}`,
    '& .MuiBadge-badge': {
      top: '6%',
      right: '6%',
    },
  },
  button: {
    transition: t.transitions.create('opacity'),
    opacity: 0.3,
    height: t.spacing(4.5),
    width: t.spacing(4.5),
  },
  opened: {
    width: 'auto',
    animation: t.transitions.create('$slide'),
    '& $head': {
      justifyContent: 'flex-start',
    },
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

interface AddColumnProps {
  hidden: Column[]
}

function AddColumn({ hidden }: AddColumnProps) {
  const classes = useAddColumnStyles()

  const [open, setOpen] = React.useState(false)
  const show = React.useCallback(() => setOpen(true), [])
  const hide = React.useCallback(() => setOpen(false), [])

  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleMouseEnter = React.useCallback(() => {
    timeoutRef.current = setTimeout(show, 100)
  }, [show])

  const handleMouseLeave = React.useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    hide()
  }, [hide])

  if (!open) {
    return (
      <div className={classes.root} onMouseEnter={handleMouseEnter}>
        <div className={classes.head}>
          <M.Badge
            variant="dot"
            color="secondary"
            overlap="circle"
            invisible={!hidden.length}
          >
            <ColumnAction className={classes.button} icon="add" />
          </M.Badge>
        </div>
      </div>
    )
  }

  return (
    <div className={cx(classes.root, classes.opened)} onMouseLeave={handleMouseLeave}>
      <div className={classes.head}>
        <M.Typography variant="subtitle2" className={classes.add}>
          Add column:
        </M.Typography>
      </div>
      <AvailableFacets onClose={hide} hidden={hidden} />
    </div>
  )
}

interface TableSkeletonProps {
  className?: string
}

export function TableSkeleton({ className }: TableSkeletonProps) {
  const COLUMNS_LEN = 5
  const ROWS_LEN = 30
  const [head, ...body] = React.useMemo(
    () =>
      Array.from({ length: ROWS_LEN }).map((_r, row) => ({
        key: row,
        columns: Array.from({ length: COLUMNS_LEN }).map((_c, key) => ({
          key,
          width: Math.max(80, Math.ceil(Math.random() * 200)),
        })),
      })),
    [],
  )
  return (
    <M.Table className={className} size="small">
      <M.TableHead>
        <M.TableRow>
          <M.TableCell />
          {head.columns.map(({ key, width }) => (
            <M.TableCell key={key}>
              <M.Typography variant="subtitle2">
                <Lab.Skeleton width={width} />
              </M.Typography>
            </M.TableCell>
          ))}
        </M.TableRow>
      </M.TableHead>
      <M.TableBody>
        {body.map((r) => (
          <M.TableRow key={r.key}>
            <M.TableCell padding="checkbox">
              <Lab.Skeleton />
            </M.TableCell>
            {r.columns.map(({ key, width }) => (
              <M.TableCell key={key}>
                <M.Typography variant="subtitle2">
                  <Lab.Skeleton width={width} />
                </M.Typography>
              </M.TableCell>
            ))}
          </M.TableRow>
        ))}
      </M.TableBody>
    </M.Table>
  )
}

const useColumnHeadStyles = M.makeStyles((t) => ({
  root: {
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
    '&:hover $actions': {
      color: t.palette.text.secondary,
    },
  },
  actions: {
    color: t.palette.text.hint,
    transition: t.transitions.create('color'),
    marginLeft: t.spacing(2),
  },
  icon: {
    color: t.palette.text.secondary,
    marginRight: t.spacing(1),
  },
}))

interface ColumnHeadProps {
  column: Column
}

function ColumnHead({ column }: ColumnHeadProps) {
  const classes = useColumnHeadStyles()
  if (column.tag === 'filter') {
    return (
      <div className={classes.root}>
        <M.Tooltip title={column.fullTitle}>
          <span>{column.title}</span>
        </M.Tooltip>
        <ColumnActions className={classes.actions} column={column} />
      </div>
    )
  }
  return (
    <div className={classes.root}>
      {column.tag === 'meta' && (
        <M.Icon className={classes.icon} fontSize="small">
          list
        </M.Icon>
      )}
      {column.title}
      <ColumnActions className={classes.actions} column={column} />
    </div>
  )
}

const noopFixme = () => {}

const isSingleKeyword = (
  predicate: SearchUIModel.PredicateState<SearchUIModel.KnownPredicate> | null,
) => predicate && predicate._tag === 'KeywordEnum' && predicate.terms.length === 1

interface ColumnBase {
  filtered: boolean
  onClose?: () => void
  onCollapse: () => void
  onSearch: () => void
  onSort: () => void
}

interface ColumnFilter extends ColumnBase {
  // keyof PackagesSearchFilter?
  filter: SearchUIModel.FilterStateForResultType<SearchUIModel.ResultType.QuiltPackage>['order'][number]
  fullTitle: string
  predicateType: SearchUIModel.KnownPredicate['_tag']
  tag: 'filter'
  title: string
}

interface ColumnMeta extends ColumnBase {
  filter: string
  predicateType: SearchUIModel.KnownPredicate['_tag']
  tag: 'meta'
  title: string
}

interface ColumnVisual extends ColumnBase {
  tag: 'visual'
  filter: string
  title: string
}

type Column = ColumnFilter | ColumnMeta | ColumnVisual

interface AllColumns {
  columns: Column[]
  hidden: Column[]
}

type UserMetaFacets = Record<string, SearchUIModel.PackageUserMetaFacet['__typename']>

interface InferedUserMetaFacets {
  workflow: UserMetaFacets
  all: UserMetaFacets
}

function useTableColumns(
  singleBucket: boolean,
  infered: Workflow.RequestResult<InferedUserMetaFacets>,
): AllColumns {
  const { actions, state } = SearchUIModel.use(SearchUIModel.ResultType.QuiltPackage)

  const [collapsed, setCollapsed] = React.useState<Record<Column['filter'], boolean>>({})

  const fixed = React.useMemo(() => {
    const name: Column = {
      predicateType: 'Text' as const,
      filter: 'name' as const,
      fullTitle: PACKAGE_FILTER_LABELS.name,
      onCollapse: () => setCollapsed((x) => ({ ...x, name: !x.name })),
      onSearch: noopFixme,
      onSort: noopFixme,
      tag: 'filter' as const,
      title: COLUMN_LABELS.name,
      filtered: false,
    }
    if (singleBucket) return [name]
    const bucket: Column = {
      filter: 'bucket' as const,
      onCollapse: () => setCollapsed((x) => ({ ...x, bucket: !x.bucket })),
      onSearch: noopFixme,
      onSort: noopFixme,
      tag: 'visual' as const,
      title: COLUMN_LABELS.bucket,
      filtered: false,
    }
    return [bucket, name]
  }, [singleBucket])

  const filters = React.useMemo(() => {
    const output: Column[] = []
    const modifiedFilters = SearchUIModel.PackagesSearchFilterIO.toGQL(state.filter)

    state.filter.order.forEach((filter) => {
      const predicate = state.filter.predicates[filter]
      invariant(!!predicate, 'Predicate should exist')
      // 'name' is added in `fixed` columns
      // 'entries' doesn't have values
      const singleKeyword = isSingleKeyword(predicate)
      if (filter !== 'name' && !singleKeyword) {
        output.push({
          predicateType: predicate._tag,
          filter,
          fullTitle: PACKAGE_FILTER_LABELS[filter],
          onClose: () => actions.deactivatePackagesFilter(filter),
          onCollapse: () => setCollapsed((x) => ({ ...x, [filter]: !x[filter] })),
          onSearch: noopFixme,
          onSort: noopFixme,
          tag: 'filter' as const,
          title: COLUMN_LABELS[filter],
          filtered: !!modifiedFilters && !!modifiedFilters[filter],
        })
      }
    })
    return output
  }, [actions, state.filter])

  const selectedUserMeta = React.useMemo(() => {
    const modifiedFilters = state.userMetaFilters.toGQL()
    const output: Column[] = []
    state.userMetaFilters.filters.forEach((predicate, filter) => {
      const singleKeyword = isSingleKeyword(predicate)
      if (!singleKeyword) {
        output.push({
          predicateType: predicate._tag,
          filter,
          onClose: () => actions.deactivatePackagesMetaFilter(filter),
          onCollapse: () => setCollapsed((x) => ({ ...x, [filter]: !x[filter] })),
          onSearch: noopFixme,
          onSort: noopFixme,
          tag: 'meta' as const,
          title: filter.replace(/^\//, ''),
          filtered: !!modifiedFilters?.find(({ path }) => path === filter),
        })
      }
    })
    return output
  }, [actions, state.userMetaFilters])

  const inferedUserMeta = React.useMemo(() => {
    const output: Column[] = []
    if (infered instanceof Error || infered === Workflow.Loading) return output
    const list = Object.keys(infered.workflow).length ? infered.workflow : infered.all
    for (const filter in list) {
      output.push({
        predicateType: SearchUIModel.PackageUserMetaFacetMap[infered.workflow[filter]],
        filter,
        onCollapse: () => setCollapsed((x) => ({ ...x, [filter]: !x[filter] })),
        onSearch: noopFixme,
        onSort: noopFixme,
        tag: 'meta' as const,
        title: filter.replace(/^\//, ''),
        filtered: false,
      })
    }
    return output
  }, [infered])

  return React.useMemo(() => {
    const output: AllColumns = { columns: [], hidden: [] }
    for (const column of [
      ...fixed,
      ...filters,
      ...selectedUserMeta,
      ...inferedUserMeta,
    ]) {
      if (collapsed[column.filter]) {
        output.hidden.push(column)
      } else {
        output.columns.push(column)
      }
    }
    return output
  }, [collapsed, fixed, filters, selectedUserMeta, inferedUserMeta])
}

function useGuessUserMetaFacets(): Workflow.RequestResult<InferedUserMetaFacets> {
  const { state } = SearchUIModel.use(SearchUIModel.ResultType.QuiltPackage)
  const selectedSingleBucket = React.useMemo(() => {
    if (state.buckets.length !== 1) return
    return state.buckets[0]
  }, [state.buckets])

  const selectedSingleWorkflow = React.useMemo(() => {
    const workflows = state.filter.predicates.workflow
    if (!workflows || workflows.terms.length !== 1) return
    return workflows.terms[0]
  }, [state.filter.predicates.workflow])

  const workflowRootKeys = Workflow.useMetadataRootKeys(
    selectedSingleBucket,
    selectedSingleWorkflow,
  )

  const searchString = SearchUIModel.useMagicWildcardsQS(state.searchString)
  const query = GQL.useQuery(META_FACETS_QUERY, {
    searchString,
    buckets: state.buckets,
    filter: SearchUIModel.PackagesSearchFilterIO.toGQL(state.filter),
    latestOnly: state.latestOnly,
  })

  return React.useMemo(
    () =>
      GQL.fold(query, {
        data: ({ searchPackages: r }) => {
          if (workflowRootKeys instanceof Error) return workflowRootKeys
          switch (r.__typename) {
            case 'EmptySearchResultSet':
            case 'InvalidInput':
              return new Error('Failed to load user meta')
            case 'PackagesSearchResultSet':
              const output: InferedUserMetaFacets = { all: {}, workflow: {} }
              r.stats.userMeta.forEach(({ __typename, path }) => {
                // Already selected
                if (state.userMetaFilters.filters.has(path)) {
                  return
                }

                // FIXME: keep sort order from workflow
                // Not found in the latest workflow schema
                if (
                  workflowRootKeys !== Workflow.Loading &&
                  workflowRootKeys.indexOf(path.replace(/^\//, '')) > -1
                ) {
                  output.workflow[path] = __typename
                }

                output.all[path] = __typename
              })
              return output

            default:
              assertNever(r)
          }
        },
        fetching: () => Workflow.Loading,
        error: (e) => e,
      }),
    [state.userMetaFilters.filters, query, workflowRootKeys],
  )
}

const useLayoutStyles = M.makeStyles((t) => ({
  root: {
    position: 'relative',
    '& th:last-child $head::after': {
      display: 'none',
    },
  },
  scrollWrapper: {
    overflow: 'hidden',
  },
  scrollArea: {
    paddingRight: t.spacing(4),
    overflowX: 'auto',
  },
  cell: {
    whiteSpace: 'nowrap',
  },
}))

interface LayoutProps {
  hits: readonly SearchUIModel.SearchHitPackage[]
  columns: Column[]
  hidden: Column[]
}

function Layout({ hits, columns, hidden }: LayoutProps) {
  const classes = useLayoutStyles()

  return (
    <M.Paper className={classes.root}>
      <div className={classes.scrollWrapper}>
        <div className={classes.scrollArea}>
          <M.Table size="small">
            <M.TableHead>
              <M.TableRow>
                <M.TableCell padding="checkbox" />
                {columns.map((column) => (
                  <M.TableCell className={classes.cell} key={column.filter}>
                    <ColumnHead column={column} />
                  </M.TableCell>
                ))}
              </M.TableRow>
            </M.TableHead>
            <M.TableBody>
              {hits.map((hit) => (
                <PackageRow key={hit.id} columns={columns} hit={hit} />
              ))}
            </M.TableBody>
          </M.Table>
        </div>
      </div>
      <AddColumn hidden={hidden} />
    </M.Paper>
  )
}

export interface TableViewProps {
  hits: readonly SearchUIModel.SearchHitPackage[]
  singleBucket: boolean
  // latestOnly: boolean
}

export function TableView({ hits, singleBucket }: TableViewProps) {
  const infered: Workflow.RequestResult<InferedUserMetaFacets> = useGuessUserMetaFacets()
  const { columns, hidden } = useTableColumns(singleBucket, infered)

  return <Layout columns={columns} hidden={hidden} hits={hits} />
}
