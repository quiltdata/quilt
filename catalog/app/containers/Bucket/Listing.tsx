import cx from 'classnames'
import * as R from 'ramda'
import * as React from 'react'
import AutosizeInput from 'react-input-autosize'
import type { AutosizeInputProps } from 'react-input-autosize'
import { Link } from 'react-router-dom'
import * as M from '@material-ui/core'
import { fade } from '@material-ui/core/styles'
import * as DG from '@material-ui/data-grid'

import { renderPageRange } from 'components/Pagination2'
import { readableBytes } from 'utils/string'
import usePrevious from 'utils/usePrevious'

const EMPTY = <i>{'<EMPTY>'}</i>

const TIP_DELAY = 1000

const TOOLBAR_INNER_HEIGHT = 28

// monkey-patch MUI built-in colDef to better align checkboxes
DG.gridCheckboxSelectionColDef.width = 32

export interface Item {
  type: 'dir' | 'file'
  name: string
  to: string
  size?: number
  modified?: Date
  archived?: boolean
}

function maxPartial<T extends R.Ord>(a: T | undefined, b: T | undefined) {
  if (a) return b ? R.max(a, b) : a
  return b
}

const computeStats = R.reduce(
  (acc, i: Item) => ({
    files: i.type === 'file' ? acc.files + 1 : acc.files,
    dirs: i.type === 'dir' && i.name !== '..' ? acc.dirs + 1 : acc.dirs,
    size: i.size ? acc.size + i.size : acc.size,
    modified: maxPartial(i.modified, acc.modified),
  }),
  {
    dirs: 0,
    files: 0,
    size: 0,
    modified: undefined as Date | undefined,
  },
)

type DataGridProps = Omit<DG.GridComponentProps, 'licenseStatus'>

const DataGrid = React.memo(
  React.forwardRef<HTMLDivElement, DataGridProps>(function DataGrid(inProps, ref) {
    const props = DG.useThemeProps({ props: inProps, name: 'MuiDataGrid' })
    return <DG.GridComponent ref={ref} {...props} licenseStatus="Valid" />
  }),
)

interface WrappedAutosizeInputProps extends Omit<AutosizeInputProps, 'ref'> {
  className?: string
}

function WrappedAutosizeInput({ className, ...props }: WrappedAutosizeInputProps) {
  return <AutosizeInput inputClassName={className} {...props} />
}

const usePrefixFilterStyles = M.makeStyles((t) => ({
  root: {
    height: TOOLBAR_INNER_HEIGHT,
    position: 'relative',
    zIndex: 1, // to be rendered above the lock
  },
  input: {
    fontSize: 14,
    height: 20,
    lineHeight: '20px',
    padding: 0,
  },
  btn: {
    fontSize: 11,
    lineHeight: '22px',
    marginLeft: t.spacing(0.75),
    minWidth: 'auto',
    paddingBottom: 0,
    paddingTop: 2,
  },
  clearIcon: {
    fontSize: '16px !important',
    lineHeight: '15px',
    marginLeft: -6,
  },
  searchIcon: {
    fontSize: 20,
    marginLeft: -2,
    marginRight: t.spacing(0.5) - 2,
  },
}))

interface PrefixFilterProps {
  prefix?: string
  setPrefix: (prefix: string) => void
}

export function PrefixFilter({ prefix = '', setPrefix }: PrefixFilterProps) {
  const classes = usePrefixFilterStyles()

  const inputRef = React.useRef<{ blur: () => void }>()
  const [prefixValue, setPrefixValue] = React.useState(prefix)

  const blur = React.useCallback(() => {
    inputRef.current?.blur?.()
  }, [inputRef])

  const apply = React.useCallback(() => {
    if (prefix === prefixValue) return
    setPrefix(prefixValue)
  }, [prefix, prefixValue, setPrefix])

  const clear = React.useCallback(() => {
    if (prefixValue) setPrefixValue('')
    if (prefix) setPrefix('')
  }, [prefix, prefixValue, setPrefix, setPrefixValue])

  const handleKeyDown = React.useCallback(
    (e) => {
      if (e.key === 'Escape') {
        clear()
        blur()
      } else if (e.key === 'Enter') {
        apply()
        blur()
      }
    },
    [blur, apply, clear],
  )

  const handleChange = React.useCallback(
    (e) => {
      setPrefixValue(e.target.value)
    },
    [setPrefixValue],
  )
  return (
    <M.InputBase
      value={prefixValue}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      placeholder="Filter current directory by prefix"
      classes={{ root: classes.root, input: classes.input }}
      inputComponent={WrappedAutosizeInput}
      inputRef={inputRef}
      startAdornment={<M.Icon className={classes.searchIcon}>search</M.Icon>}
      endAdornment={
        <>
          <M.Button
            className={classes.btn}
            size="small"
            variant="contained"
            color="primary"
            onClick={apply}
          >
            Filter
          </M.Button>
          {(!!prefixValue || !!prefix) && (
            <M.Button
              className={classes.btn}
              size="small"
              variant="text"
              color="primary"
              onClick={clear}
              endIcon={<M.Icon className={classes.clearIcon}>clear</M.Icon>}
            >
              Clear
            </M.Button>
          )}
        </>
      }
    />
  )
}

const optionsSelector = (state: DG.GridState) => state.options

const usePaginationStyles = M.makeStyles((t) => ({
  root: {
    alignItems: 'center',
    display: 'flex',
    flexGrow: 1,
    height: TOOLBAR_INNER_HEIGHT,
  },
  select: {
    alignItems: 'center',
    display: 'flex',
    height: 24,
    paddingBottom: 0,
    paddingLeft: t.spacing(0.5),
    paddingTop: 0,
  },
  input: {
    fontSize: 'inherit',
    marginRight: t.spacing(0.5),

    [t.breakpoints.down('xs')]: {
      display: 'none',
    },
  },
  button: {
    color: t.palette.action.active,
    minWidth: 'auto',
    paddingBottom: 1,
    paddingTop: 1,
  },
  current: {
    color: t.palette.text.primary,
    fontWeight: t.typography.fontWeightBold,
  },
}))

interface PaginationProps {
  truncated?: boolean
  loadMore?: () => void
}

function Pagination({ truncated, loadMore }: PaginationProps) {
  const classes = usePaginationStyles()

  const apiRef = React.useContext(DG.GridApiContext)
  const paginationState = DG.useGridSelector(apiRef, DG.gridPaginationSelector)
  const options = DG.useGridSelector(apiRef, optionsSelector)

  const page = paginationState.page + 1
  const pages = Math.ceil(paginationState.rowCount / paginationState.pageSize)

  const rowsPerPageOptions =
    options.rowsPerPageOptions &&
    options.rowsPerPageOptions.indexOf(paginationState.pageSize) > -1
      ? options.rowsPerPageOptions
      : []

  const onPageSizeChange = React.useCallback(
    (event: React.ChangeEvent<{ value: unknown }>) => {
      const newPageSize = Number(event.target.value)
      apiRef!.current!.setPageSize(newPageSize)
      // TODO: go to new last page if old last page became out of bounds
    },
    [apiRef],
  )

  // MUI pages are 0-based
  const setPage = (p: number) => apiRef!.current!.setPage(p - 1)

  const renderPage = (p: number) => (
    <M.Button
      key={`page:${p}`}
      size="small"
      className={cx(classes.button, page === p && classes.current)}
      onClick={() => setPage(p)}
    >
      {p}
    </M.Button>
  )

  const renderGap = (i: number) => (
    <M.Button key={`gap:${i}`} size="small" className={classes.button} disabled>
      &hellip;
    </M.Button>
  )

  if (!pages) return <M.Box flexGrow={1} />

  return (
    <div className={classes.root}>
      <M.Box flexGrow={1} />
      {rowsPerPageOptions.length > 1 && (
        <M.Select
          classes={{ select: classes.select }}
          input={<M.InputBase className={classes.input} />}
          value={paginationState.pageSize}
          onChange={onPageSizeChange}
        >
          {rowsPerPageOptions.map((option) => (
            <M.MenuItem key={option} value={option}>
              {option} per page
            </M.MenuItem>
          ))}
        </M.Select>
      )}
      <M.IconButton size="small" disabled={page === 1} onClick={() => setPage(page - 1)}>
        <M.Icon fontSize="small">chevron_left</M.Icon>
      </M.IconButton>
      {renderPageRange({ page, pages, renderPage, renderGap, max: 10 })}
      {truncated && !!loadMore && (
        <M.Button
          size="small"
          className={classes.button}
          onClick={loadMore}
          title="Load more"
        >
          &hellip;
        </M.Button>
      )}
      <M.IconButton
        size="small"
        disabled={page === pages}
        onClick={() => setPage(page + 1)}
      >
        <M.Icon fontSize="small">chevron_right</M.Icon>
      </M.IconButton>
    </div>
  )
}

function ActiveFilters() {
  const apiRef = React.useContext(DG.GridApiContext)
  const activeFilters = DG.useGridSelector(apiRef, DG.activeGridFilterItemsSelector)
  const lookup = DG.useGridSelector(apiRef, DG.gridColumnLookupSelector)
  const counter = DG.useGridSelector(apiRef, DG.filterGridItemsCounterSelector)

  return (
    <>
      {apiRef!.current.getLocaleText('toolbarFiltersTooltipActive')(counter)}
      <ul>
        {activeFilters.map((item) => ({
          ...(lookup[item.columnField!] && (
            <li key={item.id}>
              {lookup[item.columnField!].headerName || item.columnField}{' '}
              {item.operatorValue} {item.value}
            </li>
          )),
        }))}
      </ul>
    </>
  )
}

function FilterToolbarButton() {
  const apiRef = React.useContext(DG.GridApiContext)
  const counter = DG.useGridSelector(apiRef, DG.filterGridItemsCounterSelector)
  const preferencePanel = DG.useGridSelector(apiRef, DG.gridPreferencePanelStateSelector)

  const tooltipContentNode = React.useMemo(() => {
    if (preferencePanel.open) {
      return apiRef!.current.getLocaleText(
        'toolbarFiltersTooltipHide',
      ) as React.ReactElement
    }
    if (counter === 0) {
      return apiRef!.current.getLocaleText(
        'toolbarFiltersTooltipShow',
      ) as React.ReactElement
    }
    return <ActiveFilters />
  }, [apiRef, preferencePanel.open, counter])

  const toggleFilter = React.useCallback(() => {
    const { open, openedPanelValue } = preferencePanel
    if (open && openedPanelValue === DG.GridPreferencePanelsValue.filters) {
      apiRef!.current.hideFilterPanel()
    } else {
      apiRef!.current.showFilterPanel()
    }
  }, [apiRef, preferencePanel])

  return (
    <M.Tooltip title={tooltipContentNode} arrow enterDelay={TIP_DELAY}>
      <M.IconButton
        onClick={toggleFilter}
        size="small"
        edge="end"
        color="primary"
        aria-label={apiRef!.current.getLocaleText('toolbarFiltersLabel')}
      >
        <M.Badge badgeContent={counter} color="secondary" overlap="circle" variant="dot">
          <M.Icon fontSize="small">filter_list</M.Icon>
        </M.Badge>
      </M.IconButton>
    </M.Tooltip>
  )
}

const useToolbarStyles = M.makeStyles((t) => ({
  root: {
    alignItems: 'center',
    borderBottom: `1px solid ${t.palette.divider}`,
    display: 'flex',
    flexWrap: 'wrap',
    padding: t.spacing(0.5, 1),
    position: 'relative',
  },
  icon: {
    fontSize: t.typography.body1.fontSize,
    marginRight: t.spacing(0.5),
  },
  truncated: {
    ...t.typography.body2,
    alignItems: 'center',
    color: t.palette.text.secondary,
    display: 'flex',
    height: TOOLBAR_INNER_HEIGHT,
    marginLeft: t.spacing(1),
  },
  lock: {
    background: fade(t.palette.background.paper, 0.5),
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  loadMore: {
    font: 'inherit',
  },
  progress: {
    marginLeft: t.spacing(0.5),
  },
}))

interface ToolbarProps {
  children?: React.ReactNode
  truncated?: boolean
  locked?: boolean
  loadMore?: () => void
  items: Item[]
}

function Toolbar({
  truncated = false,
  locked = false,
  loadMore,
  items,
  children,
}: ToolbarProps) {
  const classes = useToolbarStyles()
  return (
    <div className={classes.root}>
      {children}
      {truncated && (
        <div className={classes.truncated}>
          <M.Icon className={classes.icon}>warning</M.Icon>
          Showing first {items.length} objects
          {!!loadMore && (
            <>
              <> &rarr;&nbsp;</>
              <M.Link
                onClick={loadMore}
                className={classes.loadMore}
                component="button"
                underline="always"
              >
                load more
              </M.Link>
              {locked && <M.CircularProgress size={16} className={classes.progress} />}
            </>
          )}
        </div>
      )}
      <Pagination truncated={truncated} loadMore={loadMore} />
      <FilterToolbarButton />
      {locked && <div className={classes.lock} />}
    </div>
  )
}

const usePanelStyles = M.makeStyles((t) => ({
  root: {
    zIndex: 2,
    '& select, & input': {
      boxSizing: 'content-box',
    },
  },
  paper: {
    backgroundColor: t.palette.background.paper,
    minWidth: 300,
    maxHeight: 450,
    display: 'flex',
  },
}))

function Panel({ children, open }: DG.GridPanelProps) {
  const classes = usePanelStyles()
  const apiRef = React.useContext(DG.GridApiContext)

  const getPopperModifiers = () => ({ flip: { enabled: false } })

  const handleClickAway = React.useCallback(() => {
    apiRef!.current.hidePreferences()
  }, [apiRef])

  const handleKeyDown = React.useCallback(
    (event) => {
      if (event.key === 'Escape') {
        apiRef!.current.hidePreferences()
      }
    },
    [apiRef],
  )

  const anchorEl = apiRef?.current?.columnHeadersElementRef?.current

  if (!anchorEl) return null

  return (
    <M.Popper
      placement="bottom-end"
      open={open}
      anchorEl={anchorEl}
      modifiers={getPopperModifiers()}
      className={classes.root}
      disablePortal
    >
      <M.ClickAwayListener onClickAway={handleClickAway}>
        <M.Paper className={classes.paper} elevation={8} onKeyDown={handleKeyDown}>
          {children}
        </M.Paper>
      </M.ClickAwayListener>
    </M.Popper>
  )
}

function ColumnMenu({
  hideMenu,
  currentColumn,
  open,
  id,
  labelledby,
}: DG.GridColumnMenuProps) {
  const handleListKeyDown = React.useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Tab') event.preventDefault()
      if (event.key === 'Tab' || event.key === 'Escape') hideMenu()
    },
    [hideMenu],
  )
  return (
    <M.MenuList
      id={id}
      className="MuiDataGrid-gridMenuList"
      aria-labelledby={labelledby}
      onKeyDown={handleListKeyDown}
      autoFocus={open}
    >
      <DG.SortGridMenuItems onClick={hideMenu} column={currentColumn!} />
      <DG.GridFilterMenuItem onClick={hideMenu} column={currentColumn!} />
    </M.MenuList>
  )
}

const useFooterStyles = M.makeStyles((t) => ({
  root: {
    alignItems: 'center',
    borderTop: `1px solid ${t.palette.divider}`,
    color: t.palette.text.secondary,
    display: 'flex',
    height: 36,
    position: 'relative',
  },
  lock: {
    background: fade(t.palette.background.paper, 0.5),
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  group: {
    ...t.typography.body2,
    alignItems: 'center',
    display: 'flex',

    '& + &': {
      marginLeft: t.spacing(1.5),
    },
  },
  icon: {
    fontSize: t.typography.body1.fontSize,
    marginRight: t.spacing(0.5),
  },
  loadMore: {
    font: 'inherit',
  },
  progress: {
    marginLeft: t.spacing(0.5),
  },
  truncationWarning: {
    alignItems: 'inherit',
    display: 'inherit',

    [t.breakpoints.down('xs')]: {
      display: 'none',
    },
  },
  cellFirst: {
    alignItems: 'center',
    display: 'flex',
    padding: t.spacing(0, 1),
  },
  spacer: {
    flexGrow: 1,
  },
  cellSecond: {
    paddingLeft: t.spacing(1),
    textAlign: 'right',
  },
  cellLast: {
    paddingRight: t.spacing(1),
    textAlign: 'right',
    width: COL_MODIFIED_W + t.spacing(1),
  },
}))

interface FooterProps {
  truncated?: boolean
  locked?: boolean
  loadMore?: () => void
  items: Item[]
}

function Footer({ truncated = false, locked = false, loadMore, items }: FooterProps) {
  const { state } = DG.useGridSlotComponentProps()
  const classes = useFooterStyles()

  const apiRef = React.useContext(DG.GridApiContext)
  const filterCount = DG.useGridSelector(apiRef, DG.filterGridItemsCounterSelector)

  const stats = React.useMemo(() => computeStats(items), [items])

  const filteredStats = React.useMemo(() => {
    if (!filterCount) return undefined
    const visibleItems = (state.visibleRows.visibleRows || []).map(
      (id) => state.rows.idRowsLookup[id],
    ) as unknown as Item[]
    return computeStats(visibleItems)
  }, [filterCount, state.visibleRows.visibleRows, state.rows.idRowsLookup])

  const modified = filteredStats ? filteredStats.modified : stats.modified

  return (
    <div className={classes.root}>
      <div className={classes.cellFirst}>
        <M.Tooltip title="Directories" arrow enterDelay={TIP_DELAY}>
          <div className={classes.group}>
            <M.Icon className={classes.icon}>folder_open</M.Icon>
            {filteredStats && <>{filteredStats.dirs} / </>}
            {stats.dirs}
            {truncated && '+'}
          </div>
        </M.Tooltip>

        <M.Tooltip title="Files" arrow enterDelay={TIP_DELAY}>
          <div className={classes.group}>
            <M.Icon className={classes.icon}>insert_drive_file</M.Icon>
            {filteredStats && <>{filteredStats.files} / </>}
            {stats.files}
            {truncated && '+'}
          </div>
        </M.Tooltip>

        {!!filterCount && (
          <M.Tooltip title={<ActiveFilters />} arrow enterDelay={TIP_DELAY}>
            <div className={classes.group}>
              <M.Icon className={classes.icon}>filter_list</M.Icon>
              {filterCount}
            </div>
          </M.Tooltip>
        )}

        {truncated && (
          // TODO: show tooltip with detailed description?
          <div className={classes.group}>
            <M.Icon className={classes.icon}>warning</M.Icon>
            <span className={classes.truncationWarning}>
              Showing first {items.length} objects
              {!!loadMore && (
                <>
                  <> &rarr;&nbsp;</>
                  <M.Link
                    onClick={loadMore}
                    className={classes.loadMore}
                    component="button"
                    underline="always"
                  >
                    load more
                  </M.Link>
                  {locked && (
                    <M.CircularProgress size={16} className={classes.progress} />
                  )}
                </>
              )}
            </span>
          </div>
        )}
      </div>
      <div className={classes.spacer} />
      <div className={classes.cellSecond}>
        {filteredStats && <>{readableBytes(filteredStats.size)} / </>}
        {readableBytes(stats.size, truncated ? '+' : '')}
      </div>
      <div className={classes.cellLast}>
        {modified && `${truncated ? '~' : ''}${modified.toLocaleString()}`}
      </div>
      {locked && <div className={classes.lock} />}
    </div>
  )
}

function FilteredOverlay() {
  return (
    <DG.GridOverlay>
      <M.Tooltip title={<ActiveFilters />} arrow enterDelay={TIP_DELAY}>
        <span>No files / directories satisfying active filters</span>
      </M.Tooltip>
    </DG.GridOverlay>
  )
}

export type CellProps = React.PropsWithChildren<{
  item: Item
  title?: string
  className?: string
}>

function Cell({ item, ...props }: CellProps) {
  return <Link to={item.to} {...props} />
}

function compareBy<T, V extends R.Ord>(a: T, b: T, getValue: (arg: T) => V) {
  const va = getValue(a)
  const vb = getValue(b)
  // eslint-disable-next-line no-nested-ternary
  return va < vb ? -1 : va > vb ? 1 : 0
}

// workaround to always have folders at the top and .. at the very top
// example when sorting in ascending order:
// 0 (dir "..")
// 1:dirA (dir "dirA")
// 1:dirB (dir "dirB")
// 2:fileA (file "fileA")
// 2:fileB (file "fileB")
const getNameSortValueAsc = (row: DG.GridRowModel) => {
  const i = row as unknown as Item
  if (i.type === 'dir' && i.name === '..') return '0'
  return `${i.type === 'dir' ? 1 : 2}:${i.name}`
}

// example when sorting in descending order:
// 2 (dir "..")
// 1:dirB (dir "dirB")
// 1:dirA (dir "dirA")
// 0:fileB (file "fileB")
// 0:fileA (file "fileA")
const getNameSortValueDesc = (row: DG.GridRowModel) => {
  const i = row as unknown as Item
  if (i.type === 'dir' && i.name === '..') return '2'
  return `${i.type === 'dir' ? 1 : 0}:${i.name}`
}

const localeText = {
  columnMenuSortAsc: 'Sort ascending',
  columnMenuSortDesc: 'Sort descending',
}

const COL_SIZE_W = 114
const COL_MODIFIED_W = 176

const useStyles = M.makeStyles((t) => ({
  '@global': {
    '.MuiDataGridMenu-root': {
      zIndex: t.zIndex.modal + 1, // show it over modals
    },
  },
  root: {
    position: 'relative',
    zIndex: 1, // to prevent receiveing shadow from footer
  },
  grid: {
    border: 'none',

    '& .MuiDataGrid-overlay': {
      background: fade(t.palette.background.paper, 0.5),
      zIndex: 1,
    },
    '& .MuiDataGrid-checkboxInput': {
      padding: 7,
      '& svg': {
        fontSize: 18,
      },
    },
    '& .MuiDataGrid-cell': {
      border: 'none',
      outline: 'none !important',
      padding: 0,
    },
    '& .MuiDataGrid-colCell': {
      padding: t.spacing(0, 1),
      '& .MuiDataGrid-colCellTitleContainer': {
        flex: 'none',
      },
      '& .MuiDataGrid-menuIcon': {
        margin: 0,
      },
      '& .MuiDataGrid-iconButtonContainer': {
        padding: 0,
        '& > div': {
          alignItems: 'center',
          display: 'flex',
          height: '100%',
        },
      },
      '& .MuiDataGrid-sortIcon': {
        fontSize: 20,
      },
      '& .MuiDataGrid-columnSeparator': {
        pointerEvents: 'none',
      },
      // "Size" column
      '&:nth-last-child(2)': {
        justifyContent: 'flex-end',
      },
      // "Last modified" column
      '&:last-child': {
        justifyContent: 'flex-end',
        '& .MuiDataGrid-colCellTitleContainer': {
          order: 1,
        },
        '& .MuiDataGrid-colCellTitle': {
          order: 1,
        },
        '& .MuiDataGrid-columnSeparator': {
          display: 'none',
        },
      },
    },
  },
  locked: {
    '& .MuiDataGrid-columnsContainer': {
      position: 'absolute',

      '&::after': {
        background: fade(t.palette.background.paper, 0.5),
        bottom: 0,
        content: '""',
        left: 0,
        position: 'absolute',
        right: 0,
        top: 0,
      },
    },
  },
  link: {
    padding: t.spacing(0, 1),
    width: '100%',
  },
  linkFlex: {
    alignItems: 'center',
    display: 'flex',
  },
  ellipsis: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  icon: {
    fontSize: t.typography.body1.fontSize,
    marginRight: t.spacing(0.5),
  },
  archived: {
    opacity: 0.5,
  },
}))

interface ListingProps {
  items: Item[]
  truncated?: boolean
  locked?: boolean
  prefixFilter?: string
  toolbarContents?: React.ReactNode
  loadMore?: () => void
  selection?: DG.GridRowId[]
  onSelectionChange?: (newSelection: DG.GridRowId[]) => void
  CellComponent?: React.ComponentType<CellProps>
  RootComponent?: React.ElementType<{ className: string }>
  className?: string
  dataGridProps?: Partial<DataGridProps>
}

export function Listing({
  items,
  truncated = false,
  locked = false,
  toolbarContents,
  prefixFilter,
  loadMore,
  selection,
  onSelectionChange,
  CellComponent = Cell,
  RootComponent = M.Paper,
  className,
  dataGridProps,
}: ListingProps) {
  const classes = useStyles()

  const [filteredToZero, setFilteredToZero] = React.useState(false)

  const handleFilterModelChange = React.useCallback(
    (params: DG.GridFilterModelParams) => {
      setFilteredToZero(!!params.rows.size && !params.visibleRows.size)
    },
    [setFilteredToZero],
  )

  const [page, setPage] = React.useState(0)
  const [pageSize, setPageSize] = React.useState(25)

  const handlePageChange = React.useCallback(
    ({ page: newPage }: DG.GridPageChangeParams) => {
      setPage(newPage)
    },
    [],
  )

  const handlePageSizeChange = React.useCallback(
    ({ pageSize: newPageSize }: DG.GridPageChangeParams) => {
      setPageSize(newPageSize)
    },
    [],
  )

  usePrevious(items, (prevItems?: Item[]) => {
    if (!prevItems) return
    const itemsOnPrevPages = page * pageSize
    // reset page if items on previous pages change
    if (!R.equals(R.take(itemsOnPrevPages, items), R.take(itemsOnPrevPages, prevItems))) {
      setPage(0)
    }
  })

  const columns: DG.GridColumns = React.useMemo(
    () => [
      {
        field: 'name',
        headerName: 'Name',
        type: 'string',
        width: 80,
        flex: 1,
        sortComparator: (
          _v1: unknown,
          _v2: unknown,
          p1: DG.GridSortCellParams,
          p2: DG.GridSortCellParams,
        ) => {
          // we only support one-column sorting, so assuming the first sortItem is the one we need
          const [{ sort }] = (p1.api as DG.GridApi).state.sorting.sortModel
          return compareBy(
            p1.row,
            p2.row,
            sort === 'desc' ? getNameSortValueDesc : getNameSortValueAsc,
          )
        },
        renderCell: (params: DG.GridCellParams) => {
          const i = params.row as unknown as Item
          return (
            <CellComponent
              item={i}
              title={i.archived ? 'Object archived' : undefined}
              className={cx(
                classes.link,
                classes.linkFlex,
                i.archived && classes.archived,
              )}
            >
              <M.Icon className={classes.icon}>
                {i.type === 'file' ? 'insert_drive_file' : 'folder_open'}
              </M.Icon>
              <span className={classes.ellipsis}>{i.name || EMPTY}</span>
            </CellComponent>
          )
        },
      },
      // TODO: uncomment this after implementing custom filter operators
      // {
      //   field: 'type',
      //   headerName: 'Type',
      //   type: 'string',
      //   hide: true,
      //   // TODO: custom filter operators
      //   // filterOperators: GridFilterOperator[]
      // },
      {
        field: 'size',
        headerName: 'Size',
        type: 'number',
        width: COL_SIZE_W,
        renderCell: (params: DG.GridCellParams) => {
          const i = params.row as unknown as Item
          return (
            <CellComponent
              item={i}
              className={cx(classes.link, i.archived && classes.archived)}
              title={i.archived ? 'Object archived' : undefined}
            >
              {i.size == null ? <>&nbsp;</> : readableBytes(i.size)}
            </CellComponent>
          )
        },
      },
      {
        field: 'modified',
        headerName: 'Last modified',
        type: 'dateTime',
        align: 'right',
        width: COL_MODIFIED_W,
        renderCell: (params: DG.GridCellParams) => {
          const i = params.row as unknown as Item
          return (
            <CellComponent
              item={i}
              className={cx(classes.link, i.archived && classes.archived)}
              title={i.archived ? 'Object archived' : undefined}
            >
              {i.modified == null ? <>&nbsp;</> : i.modified.toLocaleString()}
            </CellComponent>
          )
        },
      },
    ],
    [classes, CellComponent],
  )

  const noRowsLabel = `No files / directories${
    prefixFilter ? ` starting with "${prefixFilter}"` : ''
  }`

  // abuse loading overlay to show warning when all the items are filtered-out
  const LoadingOverlay = !locked && filteredToZero ? FilteredOverlay : undefined

  const handleSelectionModelChange = React.useCallback(
    (newSelection: DG.GridSelectionModelChangeParams) => {
      if (onSelectionChange) onSelectionChange(newSelection.selectionModel)
    },
    [onSelectionChange],
  )

  // TODO: control page, pageSize, filtering and sorting via props
  return (
    <RootComponent className={cx(classes.root, className)}>
      <DataGrid
        onFilterModelChange={handleFilterModelChange}
        className={cx(classes.grid, locked && classes.locked)}
        rows={items}
        columns={columns}
        autoHeight
        components={{ Toolbar, Footer, Panel, ColumnMenu, LoadingOverlay }}
        componentsProps={{
          toolbar: { truncated, locked, loadMore, items, children: toolbarContents },
          footer: { truncated, locked, loadMore, items },
        }}
        getRowId={(row) => row.name.replaceAll("'", "\\'")}
        pagination
        pageSize={pageSize}
        onPageSizeChange={handlePageSizeChange}
        page={page}
        onPageChange={handlePageChange}
        loading={locked || filteredToZero}
        headerHeight={36}
        rowHeight={36}
        disableSelectionOnClick
        disableColumnSelector
        disableColumnResize
        disableColumnReorder
        disableMultipleSelection
        disableMultipleColumnsSorting
        localeText={{ noRowsLabel, ...localeText }}
        // selection-related props
        checkboxSelection={!!onSelectionChange}
        selectionModel={selection}
        onSelectionModelChange={handleSelectionModelChange}
        {...dataGridProps}
      />
    </RootComponent>
  )
}

export default Listing
