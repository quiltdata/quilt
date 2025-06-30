import { extname, join } from 'path'

import cx from 'classnames'
import invariant from 'invariant'
import jsonpath from 'jsonpath'
import * as React from 'react'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import { TinyTextField } from 'components/Filters'
import * as Preview from 'components/Preview'
import JsonDisplay from 'components/JsonDisplay'
import type { RouteMap } from 'containers/Bucket/BucketNav'
import * as Model from 'model'
import * as GQL from 'utils/GraphQL'
import * as JSONPointer from 'utils/JSONPointer'
import { Leaf } from 'utils/KeyedTree'
import * as NamedRoutes from 'utils/NamedRoutes'
import StyledLink from 'utils/StyledLink'
import StyledTooltip from 'utils/StyledTooltip'
import assertNever from 'utils/assertNever'
import * as Format from 'utils/format'
import type { PackageHandle } from 'utils/packageHandle'
import * as s3paths from 'utils/s3paths'
import { readableBytes } from 'utils/string'
import type { Json, JsonRecord } from 'utils/types'

import BucketSelector from '../Buckets'
import FilterWidget from '../FilterWidget'
import { PACKAGES_FILTERS_PRIMARY, PACKAGES_FILTERS_SECONDARY } from '../constants'
import { COLUMN_LABELS, PACKAGE_FILTER_LABELS } from '../i18n'
import * as SearchUIModel from '../model'

import META_FACETS_QUERY from '../gql/PackageMetaFacets.generated'

import * as Workflow from './workflow'

const AVAILABLE_PACKAGES_FILTERS = [
  ...PACKAGES_FILTERS_PRIMARY,
  ...PACKAGES_FILTERS_SECONDARY,
]

interface FilterContext {
  // TODO: move collapsing columns here
  focused: Column | null
  openFilter: (c: Column) => void
  closeFilter: () => void
}

const FilterCtx = React.createContext<FilterContext>({
  focused: null,
  openFilter: () => {},
  closeFilter: () => {},
})

function FilterProvider({ children }: { children: React.ReactNode }) {
  const [focused, setFocused] = React.useState<Column | null>(null)
  const openFilter = React.useCallback((c: Column) => setFocused(c), [])
  const closeFilter = React.useCallback(() => setFocused(null), [])
  return (
    <FilterCtx.Provider value={{ focused, openFilter, closeFilter }}>
      {children}
    </FilterCtx.Provider>
  )
}

const useFilterContext = () => React.useContext(FilterCtx)

const useNoValueStyles = M.makeStyles((t) => ({
  root: {
    display: 'inline-block',
    width: t.spacing(2),
    verticalAlign: 'middle',
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

const useMatchStyles = M.makeStyles((t) => ({
  root: {
    // background: M.fade(t.palette.warning.light, 0.7),
    padding: t.spacing(0, 0.5),
    margin: t.spacing(0, -0.5),
  },
}))

interface MatchProps extends React.HTMLProps<HTMLSpanElement> {
  in: boolean
}

function Match({ className, children, ...rest }: MatchProps) {
  const classes = useMatchStyles()
  return (
    <span className={cx(rest.in && classes.root, className)} {...rest}>
      {children}
    </span>
  )
}

interface SystemMetaValueProps {
  hit: SearchUIModel.SearchHitPackage
  filter: FilterType | 'bucket'
}

function SystemMetaValue({ hit, filter }: SystemMetaValueProps) {
  const { urls } = NamedRoutes.use<RouteMap>()
  switch (filter) {
    case 'workflow':
      return hit.workflow ? (
        <Match in={hit.matchLocations.workflow}>{hit.workflow.id}</Match>
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
        <StyledLink to={urls.bucketPackageTree(hit.bucket, hit.name, hit.hash)}>
          <Match in={hit.matchLocations.name}>{hit.name}</Match>
        </StyledLink>
      )
    case 'comment':
      return hit.comment ? (
        <StyledTooltip title={hit.comment} placement="bottom-start">
          <Match in={hit.matchLocations.comment}>{hit.comment}</Match>
        </StyledTooltip>
      ) : (
        <NoValue />
      )
    case 'modified':
      return <Format.Relative value={hit.modified} />
    case 'entries':
      return hit.totalEntriesCount
    case 'bucket':
      return hit.bucket
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
      <StyledTooltip title={`${meta}`}>
        <M.Icon color="disabled" fontSize="small" style={{ verticalAlign: 'middle' }}>
          error_outline
        </M.Icon>
      </StyledTooltip>
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
    // TODO: what is this number, should be equal to some `sticky` padding
    right: t.spacing(-2.5),
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
    // background: t.palette.warning.light,
  },
  sticky: {
    animation: t.transitions.create(['$fade', '$growDown']),
    // It is positioned where it would be without `absolute`,
    // but it continues to stay there when table is scrolled.
    position: 'absolute',
    padding: t.spacing(2, 2, 2, 6.5),
    // fullWidth
    //  // FIXME: update description
    //  - page container paddings
    //  - sidebar margin (grid gap)
    //  - "Add column" widget width
    width: `calc(100vw - ${t.spacing(3 * 2)}px - ${t.spacing(4)}px - ${t.spacing(4)}px)`,
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
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: t.spacing(2),
  },
  close: {
    margin: t.spacing(-1, -2),
  },
  totalCount: {
    paddingTop: t.spacing(2),
    paddingLeft: 0,
  },
}))

interface PreviewEntry {
  type: 'meta' | 'content'
  entry: Model.GQLTypes.SearchHitPackageMatchingEntry
}

interface EntryProps {
  className: string
  entry: Model.GQLTypes.SearchHitPackageMatchingEntry
  onPreview: (x: PreviewEntry) => void
  packageHandle: PackageHandle
}

function Entry({ className, entry, onPreview, packageHandle }: EntryProps) {
  const classes = useEntriesStyles()
  const { urls } = NamedRoutes.use<RouteMap>()
  const handlePreview = React.useCallback(
    () => onPreview({ type: 'content', entry }),
    [entry, onPreview],
  )
  const handleMeta = React.useCallback(
    () => onPreview({ type: 'meta', entry }),
    [entry, onPreview],
  )
  const inBucket = React.useMemo(() => {
    const { bucket, key, version } = s3paths.parseS3Url(entry.physicalKey)
    return {
      title: decodeURI(entry.physicalKey),
      to: urls.bucketFile(bucket, key, { version }),
    }
  }, [entry.physicalKey, urls])
  const inPackage = React.useMemo(() => {
    const { bucket, name, hash } = packageHandle
    return {
      title: decodeURIComponent(entry.logicalKey),
      to: urls.bucketPackageTree(bucket, name, hash, entry.logicalKey),
    }
  }, [entry.logicalKey, packageHandle, urls])
  return (
    <M.TableRow hover key={entry.physicalKey} className={className}>
      <M.TableCell className={classes.cell} component="th" scope="row">
        <StyledTooltip title={entry.logicalKey}>
          <StyledLink to={inPackage.to}>
            <Match in={entry.matchLocations.logicalKey}>{inPackage.title}</Match>
          </StyledLink>
        </StyledTooltip>
      </M.TableCell>
      <M.TableCell className={classes.cell}>
        <StyledTooltip title={entry.physicalKey}>
          <StyledLink to={inBucket.to}>
            <Match in={entry.matchLocations.physicalKey}>{inBucket.title}</Match>
          </StyledLink>
        </StyledTooltip>
      </M.TableCell>
      <M.TableCell className={classes.cell} align="right">
        {readableBytes(entry.size)}
      </M.TableCell>
      <M.TableCell className={classes.cell} align="center">
        {entry.meta ? (
          <M.IconButton
            size="small"
            onClick={handlePreview}
            className={cx(entry.matchLocations.meta && classes.match)}
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
          className={cx(classes.content, entry.matchLocations.meta && classes.match)}
          onClick={handleMeta}
        >
          {extname(entry.logicalKey).substring(1)}
        </span>
      </M.TableCell>
    </M.TableRow>
  )
}

interface EntriesProps {
  entries: readonly Model.GQLTypes.SearchHitPackageMatchingEntry[]
  packageHandle: PackageHandle
  totalCount: number
}

function Entries({ entries, packageHandle, totalCount }: EntriesProps) {
  const { urls } = NamedRoutes.use<RouteMap>()

  const classes = useEntriesStyles()
  const ref = React.useRef<HTMLDivElement>(null)
  const [height, setHeight] = React.useState('auto')

  const [preview, setPreview] = React.useState<PreviewEntry | null>(null)

  React.useEffect(() => {
    if (!ref.current) return
    setHeight(`${ref.current.clientHeight}px`)
  }, [entries])

  // TODO:
  // const entriesColumns = [{ title: 'Logical Key', key: logicalKey }, ...]
  // colSpan = entriesColumns.length
  // and pass it to <Entry />

  return (
    <div className={cx(classes.root)} style={{ height }}>
      <div className={classes.sticky} ref={ref}>
        <M.Table size="small" className={classes.table}>
          <M.TableHead>
            <M.TableRow>
              <M.TableCell className={classes.cell}>Logical Key</M.TableCell>
              <M.TableCell className={classes.cell}>Physical Key</M.TableCell>
              <M.TableCell className={classes.cell} align="right" width="100px">
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
              <Entry
                className={classes.row}
                key={entry.logicalKey + entry.physicalKey}
                entry={entry}
                onPreview={setPreview}
                packageHandle={packageHandle}
              />
            ))}
            {entries.length < totalCount && (
              <M.TableRow className={classes.row}>
                <M.TableCell colSpan={5} className={cx(classes.cell, classes.totalCount)}>
                  <M.Typography variant="caption" component="p">
                    <StyledLink
                      to={urls.bucketPackageDetail(
                        packageHandle.bucket,
                        packageHandle.name,
                      )}
                    >
                      Package contains {totalCount - entries.length} additional entries
                      {entries.length >= 10 && <span>, some may match the search</span>}
                    </StyledLink>
                  </M.Typography>
                </M.TableCell>
              </M.TableRow>
            )}
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
    <StyledTooltip title={title}>
      <M.IconButton className={className}>
        <M.Badge badgeContent={size} color="default" classes={{ badge: classes.badge }}>
          <M.Icon className={open ? classes.expanded : classes.collapsed}>
            {open ? 'expand_more' : 'chevron_right'}
          </M.Icon>
        </M.Badge>
      </M.IconButton>
    </StyledTooltip>
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
}

function PackageRow({ columns, hit }: PackageRowProps) {
  const meta = hit.meta && typeof hit.meta === 'string' ? JSON.parse(hit.meta) : {}
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
  // 2 additional columns for <UnfoldPackageEntries/> and as a placeholder for <ColumnAdd />
  // const colSpan = visibleColumns.length + 2

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
        {visibleColumns.map((column) => {
          switch (column.tag) {
            case 'bucket':
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
            default:
              assertNever(column)
          }
        })}
        <M.TableCell className={classes.placeholder} />
      </M.TableRow>
      {!!hit.matchingEntries?.length && (
        <M.TableRow>
          <M.TableCell className={classes.entries} colSpan={visibleColumns.length + 2}>
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

interface ColumnActionProps extends M.IconButtonProps {
  className?: string
  icon: string
}

const ColumnAction = React.forwardRef<HTMLButtonElement, ColumnActionProps>(
  function ColumnAction({ className, icon, ...props }, ref) {
    return (
      <M.IconButton
        className={className}
        ref={ref}
        size="small"
        color={props.color || 'inherit'}
        {...props}
      >
        <M.Icon color="inherit" fontSize="inherit">
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
  single: boolean
}

function ColumnActions({ className, column, single }: ColumnActionsProps) {
  const classes = useColumnActionsStyles()
  const model = SearchUIModel.use(SearchUIModel.ResultType.QuiltPackage)
  const { openFilter } = useFilterContext()

  const [menuOpened, setMenuOpened] = React.useState(false)
  const showMenu = React.useCallback(() => setMenuOpened(true), [])
  const hideMenu = React.useCallback(() => setMenuOpened(false), [])

  const showFilter = React.useCallback(() => {
    switch (column.tag) {
      case 'meta':
        model.actions.activatePackagesMetaFilter(column.filter, column.predicateType)
        break
      case 'filter':
        model.actions.activatePackagesFilter(column.filter)
        break
    }
    openFilter(column)
  }, [column, model.actions, openFilter])

  const [anchorEl, setAnchorEl] = React.useState<HTMLElement | null>(null)

  const handleHide = React.useCallback(() => {
    if (!column.filtered && column.onClose) {
      column.onClose()
    } else {
      column.onCollapse()
    }
  }, [column])

  return (
    <div
      className={cx(classes.root, className)}
      ref={(el) => setAnchorEl(el?.parentElement || el)}
    >
      <ColumnAction
        color={column.filtered ? 'primary' : 'inherit'}
        icon="filter_list"
        onClick={showFilter}
      />
      {column.filtered ? (
        <ColumnAction icon="close" onClick={showMenu} onMouseEnter={showMenu} />
      ) : (
        !single && (
          <StyledTooltip
            title={column.onClose ? 'Deactivate filter and hide column' : 'Hide column'}
          >
            <ColumnAction icon="close" onClick={handleHide} />
          </StyledTooltip>
        )
      )}
      <M.Popover
        open={menuOpened}
        anchorEl={anchorEl}
        onClose={hideMenu}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
        PaperProps={{
          onMouseLeave: hideMenu,
        }}
      >
        <M.List dense>
          {!single && (
            <M.ListItem button onClick={handleHide}>
              <M.ListItemIcon>
                <M.Icon>visibility</M.Icon>
              </M.ListItemIcon>
              <M.ListItemText primary="Hide column" />
            </M.ListItem>
          )}
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
}))

interface FilterGroupProps {
  disabled?: boolean
  path?: string
  items: SearchUIModel.FacetTree['children']
  columns: ColumnsMap
}

function FilterGroup({ columns, disabled, path, items }: FilterGroupProps) {
  const classes = useFilterGroupStyles()
  const { openFilter } = useFilterContext()

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
  const { activatePackagesMetaFilter, deactivatePackagesMetaFilter } = model.actions
  const activate = React.useCallback(
    (node: Leaf<SearchUIModel.PackageUserMetaFacet>) => {
      const type = SearchUIModel.PackageUserMetaFacetMap[node.value.__typename]
      activatePackagesMetaFilter(node.value.path, type)
      const column = columns.get(node.value.path)
      if (column) {
        openFilter(column)
      }
    },
    [activatePackagesMetaFilter, columns, openFilter],
  )

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
            {Array.from(items).map(([p, node]) =>
              node._tag === 'Tree' ? (
                <FilterGroup
                  disabled={disabled}
                  items={node.children}
                  key={path + p}
                  path={p}
                  columns={columns}
                />
              ) : (
                <M.MenuItem key={path + p} onClick={() => activate(node)}>
                  <M.ListItemText {...getLabel(p)} />
                  <M.ListItemSecondaryAction>
                    <M.Checkbox
                      edge="end"
                      onChange={() =>
                        !!columns.get(node.value.path)?.state.visible ||
                        columns.get(node.value.path)?.state.inferred
                          ? activate(node)
                          : () => deactivatePackagesMetaFilter(node.value.path)
                      }
                      checked={columns.get(node.value.path)?.state.visible}
                    />
                  </M.ListItemSecondaryAction>
                </M.MenuItem>
              ),
            )}
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

const useAvailableFacetsStyles = M.makeStyles((t) => ({
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

interface AvailableFacetsProps {
  columns: ColumnsMap
  onClose: () => void
  state: SearchUIModel.AvailableFiltersStateInstance
}

function AvailableFacets({ columns, onClose, state }: AvailableFacetsProps) {
  const classes = useAvailableFacetsStyles()
  const { openFilter } = useFilterContext()

  const filterValue = SearchUIModel.AvailableFiltersState.match(
    {
      Ready: (ready) =>
        SearchUIModel.FacetsFilteringState.match({
          Enabled: ({ value }) => value,
          Disabled: () => '',
        })(ready.filtering),
      Loading: () => '',
      Empty: () => '',
    },
    state,
  )

  const model = SearchUIModel.use(SearchUIModel.ResultType.QuiltPackage)
  const availableFilters = React.useMemo(
    () =>
      [...PACKAGES_FILTERS_PRIMARY, ...PACKAGES_FILTERS_SECONDARY].filter(
        // TODO: Filter fullTitle as well
        (f) => f.indexOf(filterValue) > -1,
      ),
    [filterValue],
  )

  const enabledMetaFiltersItems = React.useMemo(
    () =>
      SearchUIModel.groupFacets(
        Array.from(model.state.userMetaFilters.filters)
          .map(([path, f]) => ({
            __typename: ReversPackageUserMetaTypename[f._tag],
            path,
          }))
          .filter(({ path }) => path.indexOf(filterValue) > -1),
      )[0].children,
    [model.state.userMetaFilters.filters, filterValue],
  )

  const { activatePackagesFilter, deactivatePackagesFilter } = model.actions
  const handleFilter = React.useCallback(
    (filter: (typeof availableFilters)[number]) => {
      if (!model.state.filter.predicates[filter]) {
        activatePackagesFilter(filter)
      }
      const column = columns.get(filter)
      if (column) {
        openFilter(column)
      }
      onClose()
    },
    [activatePackagesFilter, columns, model.state.filter.predicates, onClose, openFilter],
  )

  return (
    <div className={classes.root}>
      <M.List className={classes.list} dense>
        {!!availableFilters.length && (
          <>
            <M.ListSubheader>System metadata</M.ListSubheader>

            {availableFilters.map((filter) => (
              <M.MenuItem key={filter} onClick={() => handleFilter(filter)}>
                <M.ListItemText primary={PACKAGE_FILTER_LABELS[filter]} />
                <M.ListItemSecondaryAction>
                  <M.Checkbox
                    edge="end"
                    onChange={(_e, checked) => {
                      if (checked) {
                        handleFilter(filter)
                      } else {
                        const column = columns.get(filter)
                        if (!column) return
                        if (column.filtered) {
                          column.onCollapse()
                        } else {
                          deactivatePackagesFilter(filter)
                        }
                      }
                    }}
                    checked={columns.get(filter)?.state.visible}
                  />
                </M.ListItemSecondaryAction>
              </M.MenuItem>
            ))}
          </>
        )}

        {!!availableFilters.length && <M.Divider className={classes.divider} />}
        <M.ListSubheader>User metadata</M.ListSubheader>

        <FilterGroup items={enabledMetaFiltersItems} columns={columns} />

        {SearchUIModel.AvailableFiltersState.match(
          {
            Loading: () => <M.Typography>Analyzing metadata&hellip;</M.Typography>,
            Empty: () => null,
            Ready: ({ facets: { available } }) => (
              <FilterGroup
                items={SearchUIModel.groupFacets(available)[0].children}
                columns={columns}
              />
            ),
          },
          state,
        )}
      </M.List>
    </div>
  )
}

const useAddColumnStyles = M.makeStyles((t) => ({
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
      top: '6%',
      right: '6%',
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

interface AddColumnProps {
  columns: ColumnsMap
  state: SearchUIModel.AvailableFiltersStateInstance
}

function AddColumn({ columns, state }: AddColumnProps) {
  const classes = useAddColumnStyles()

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

  const [filterValue, setFilterValue] = React.useState('')

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
            invisible={/* FIXME */ true}
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

      {SearchUIModel.AvailableFiltersState.match(
        {
          Ready: (ready) =>
            SearchUIModel.FacetsFilteringState.match({
              Enabled: ({ value, set }) => (
                <TinyTextField
                  autoFocus
                  className={classes.input}
                  onChange={set}
                  placeholder="Find metadata"
                  value={value}
                />
              ),
              Disabled: () => (
                <TinyTextField
                  autoFocus
                  className={classes.input}
                  onChange={setFilterValue}
                  placeholder="Find metadata"
                  value={filterValue}
                />
              ),
            })(ready.filtering),
          Loading: () => <h1>Loading</h1>,
          Empty: () => <h1>Empty</h1>,
        },
        state,
      )}

      <AvailableFacets columns={columns} onClose={hide} state={state} />
    </div>
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
    marginLeft: t.spacing(2),
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
  return (
    <div className={classes.root}>
      <p className={classes.title}>
        {column.tag === 'filter' ? (
          <StyledTooltip title={column.fullTitle}>
            <span>{column.title}</span>
          </StyledTooltip>
        ) : (
          column.title
        )}
      </p>
      <ColumnActions className={classes.actions} column={column} single={single} />
    </div>
  )
}

interface ColumnState {
  filtered: boolean
  visible: boolean
  inferred: boolean
}

interface ColumnBase {
  filtered: boolean
  onClose?: () => void
  onCollapse: () => void
  state: ColumnState
}

interface ColumnBucket extends ColumnBase {
  filter: 'bucket'
  tag: 'bucket'
  title: string
}

interface ColumnFilter extends ColumnBase {
  filter: FilterType
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

type Column = ColumnBucket | ColumnFilter | ColumnMeta

type UserMetaFacets = Record<string, SearchUIModel.PackageUserMetaFacet['__typename']>

interface InferedUserMetaFacets {
  workflow: UserMetaFacets
  all: UserMetaFacets
}

type ColumnsMap = Map<Column['filter'], Column>

interface AllColumns {
  columns: ColumnsMap
}

function useColumns(
  infered: Workflow.RequestResult<InferedUserMetaFacets>,
  bucket?: string,
): AllColumns {
  const { actions, state } = SearchUIModel.use(SearchUIModel.ResultType.QuiltPackage)

  const [collapsed, setCollapsed] = React.useState<Record<Column['filter'], boolean>>({})

  const fixed = React.useMemo(() => {
    const nameCol: Column = {
      predicateType: 'KeywordWildcard' as const,
      filter: 'name' as const,
      fullTitle: PACKAGE_FILTER_LABELS.name,
      onClose: () => actions.deactivatePackagesFilter('name'),
      onCollapse: () => setCollapsed((x) => ({ ...x, name: !x.name })),
      tag: 'filter' as const,
      title: COLUMN_LABELS.name,
      filtered: !!state.filter.predicates.name,
      state: {
        filtered: !!state.filter.predicates.name,
        visible: !collapsed.name,
        inferred: false,
      },
    }
    if (bucket) return [nameCol]
    const bucketCol: Column = {
      filter: 'bucket' as const,
      onClose: () => actions.setBuckets([]),
      onCollapse: () => setCollapsed((x) => ({ ...x, bucket: !x.bucket })),
      tag: 'bucket' as const,
      title: COLUMN_LABELS.bucket,
      filtered: !!state.buckets.length,
      state: {
        filtered: !!state.buckets.length,
        visible: !collapsed.bucket,
        inferred: false,
      },
    }
    return [bucketCol, nameCol]
  }, [
    actions,
    state.buckets.length,
    state.filter.predicates.name,
    collapsed.bucket,
    collapsed.name,
    bucket,
  ])

  const filters = React.useMemo(() => {
    const output: Column[] = []
    const modifiedFilters = SearchUIModel.PackagesSearchFilterIO.toGQL(state.filter)

    AVAILABLE_PACKAGES_FILTERS.forEach((filter) => {
      const predicate = state.filter.predicates[filter]
      // 'name' is added in `fixed` columns
      if (filter !== 'name') {
        output.push({
          predicateType: predicate?._tag || 'Text',
          filter,
          fullTitle: PACKAGE_FILTER_LABELS[filter],
          onClose: () => actions.deactivatePackagesFilter(filter),
          onCollapse: () => setCollapsed((x) => ({ ...x, [filter]: !x[filter] })),
          tag: 'filter' as const,
          title: COLUMN_LABELS[filter],
          filtered: !!modifiedFilters && !!modifiedFilters[filter],
          state: {
            filtered: !!modifiedFilters && !!modifiedFilters[filter],
            visible: !!predicate && !collapsed[filter],
            inferred: false,
          },
        })
      }
    })
    return output
  }, [actions, collapsed, state.filter])

  const selectedUserMeta = React.useMemo(() => {
    const modifiedFilters = state.userMetaFilters.toGQL()
    const output: Column[] = []
    state.userMetaFilters.filters.forEach((predicate, filter) => {
      output.push({
        predicateType: predicate._tag,
        filter,
        onClose: () => actions.deactivatePackagesMetaFilter(filter),
        onCollapse: () => setCollapsed((x) => ({ ...x, [filter]: !x[filter] })),
        tag: 'meta' as const,
        title: filter.replace(/^\//, ''),
        filtered: !!modifiedFilters?.find(({ path }) => path === filter),
        state: {
          filtered: !!modifiedFilters?.find(({ path }) => path === filter),
          visible: !collapsed[filter],
          inferred: false,
        },
      })
    })
    return output
  }, [actions, collapsed, state.userMetaFilters])

  const inferedUserMeta = React.useMemo(() => {
    const output: Column[] = []
    if (infered instanceof Error || infered === Workflow.Loading) return output
    const list = Object.keys(infered.workflow).length ? infered.workflow : infered.all
    for (const filter in list) {
      output.push({
        predicateType: SearchUIModel.PackageUserMetaFacetMap[list[filter]],
        filter,
        onCollapse: () => setCollapsed((x) => ({ ...x, [filter]: !x[filter] })),
        tag: 'meta' as const,
        title: filter.replace(/^\//, ''),
        filtered: false,
        state: {
          filtered: false,
          visible: !collapsed[filter],
          inferred: true,
        },
      })
    }
    return output
  }, [collapsed, infered])

  return React.useMemo(() => {
    const columns = new Map(
      [...fixed, ...filters, ...selectedUserMeta, ...inferedUserMeta].map((c) => [
        c.filter,
        c,
      ]),
    )
    return { columns }
  }, [fixed, filters, selectedUserMeta, inferedUserMeta])
}

function useInferredUserMetaFacets(): Workflow.RequestResult<InferedUserMetaFacets> {
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

                // Not found in the latest workflow schema
                if (
                  workflowRootKeys !== Workflow.Loading &&
                  workflowRootKeys.indexOf(path.replace(/^\//, '')) > -1
                ) {
                  if (output.workflow[path] !== 'KeywordPackageUserMetaFacet') {
                    // FIXME: keep sort order from workflow
                    output.workflow[path] = __typename
                  }
                }

                if (output.all[path] !== 'KeywordPackageUserMetaFacet') {
                  output.all[path] = __typename
                }
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
}

function Layout({ hits, columns }: LayoutProps) {
  const classes = useLayoutStyles()
  const { focused, closeFilter } = useFilterContext()

  return (
    <M.Paper className={classes.root}>
      <SearchUIModel.AvailablePackagesMetaFilters>
        {(state: SearchUIModel.AvailableFiltersStateInstance) => (
          <AddColumn columns={columns} state={state} />
        )}
      </SearchUIModel.AvailablePackagesMetaFilters>

      <div className={classes.scrollWrapper}>
        <div className={classes.scrollArea}>
          <M.Table size="small">
            <M.TableHead>
              <M.TableRow>
                <M.TableCell padding="checkbox" />
                {Array.from(columns).map(
                  ([key, column]) =>
                    column.state.visible && (
                      <M.TableCell className={classes.cell} key={key}>
                        <ColumnHead column={column} single={columns.size === 1} />
                      </M.TableCell>
                    ),
                )}
                <M.TableCell className={classes.placeholder} />
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

      <M.Dialog open={!!focused} onClose={closeFilter} maxWidth="sm" fullWidth>
        {focused && (
          <>
            <M.DialogTitle>
              {focused.tag === 'filter' ? focused.fullTitle : focused.title}
            </M.DialogTitle>
            <M.DialogContent>
              {focused.filter === 'bucket' && <BucketSelector />}
              {focused.tag === 'filter' && (
                <Filter filter={focused.filter} onClose={closeFilter} />
              )}
              {focused.tag === 'meta' && (
                <MetaFilter path={focused.filter} onClose={closeFilter} />
              )}
            </M.DialogContent>
            <M.DialogActions>
              <M.Button color="primary" onClick={closeFilter}>
                Ok
              </M.Button>
            </M.DialogActions>
          </>
        )}
      </M.Dialog>
    </M.Paper>
  )
}

interface TableViewProps {
  hits: readonly SearchUIModel.SearchHitPackage[]
  bucket?: string
}

export default function TableView({ hits, bucket }: TableViewProps) {
  const infered: Workflow.RequestResult<InferedUserMetaFacets> =
    useInferredUserMetaFacets()
  const { columns } = useColumns(infered, bucket)
  return (
    <FilterProvider>
      <Layout columns={columns} hits={hits} />
    </FilterProvider>
  )
}
