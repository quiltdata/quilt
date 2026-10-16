import type { JSONType } from 'ajv'
import cx from 'classnames'
import * as R from 'ramda'
import * as React from 'react'
import useResizeObserver from 'use-resize-observer'
import * as RTable from 'react-table'
import * as M from '@material-ui/core'

import * as JSONPointer from 'utils/JSONPointer'
import type { JsonRecord } from 'utils/types'

import AddArrayItem from './AddArrayItem'
import AddRow from './AddRow'
import Breadcrumbs from './Breadcrumbs'
import Cell from './Cell'
import EmptyRow from './EmptyRow'
import Row from './Row'
import { getJsonDictValue } from './State'
import * as Toolbar from './Toolbar'
import { COLUMN_IDS, EditorMode, JsonValue, RowData } from './constants'

// four columns stop fitting here; a phone-width pane gets one card per field
const CARDS_BELOW = 520

const useStyles = M.makeStyles((t) => ({
  head: {
    ...t.typography.caption,
    background: t.palette.background.default,
    border: `1px solid ${t.palette.grey[400]}`,
    color: t.palette.text.secondary,
    fontWeight: t.typography.fontWeightMedium,
    padding: t.spacing(0.5, 1),
  },
  root: {
    flex: 'none',
    padding: '1px 0', // NOTE: fit 2px border for input
    position: 'relative',
    width: '100%',
  },
  // property mode in a narrow column: each row becomes a card (name + type, value, about)
  cards: {
    '& table, & tbody': { display: 'block' },
    '& thead': { display: 'none' },
    '& tbody > tr': {
      border: `1px solid ${t.palette.grey[400]}`,
      borderRadius: t.shape.borderRadius,
      display: 'grid',
      gridTemplateAreas: '"key type" "value value" "about about"',
      gridTemplateColumns: 'minmax(0, 1fr) auto',
      marginBottom: t.spacing(1),
    },
    '& tbody > tr > td': { border: 0, width: 'auto' },
    '& tbody > tr > td:nth-child(1)': { gridArea: 'key' },
    '& tbody > tr > td:nth-child(2)': {
      gridArea: 'value',
      // a finger edits here: Touch Floor Rule
      minHeight: 44,
    },
    '& tbody > tr > td:nth-child(3)': { gridArea: 'type' },
    '& tbody > tr > td:nth-child(4)': { gridArea: 'about' },
  },
  breadcrumbs: {
    alignItems: 'center',
    border: `1px solid ${t.palette.grey[400]}`,
    borderWidth: '1px 1px 0',
    color: t.palette.text.hint,
    display: 'flex',
    padding: '4px 8px',
  },
  sibling: {
    flex: 1,

    '& + &': {
      marginLeft: '-1px',
    },
  },
  siblingButton: {
    paddingLeft: t.spacing(1),
  },
  scroll: {
    maxHeight: `calc(100% - ${t.spacing(8)}px)`,
    overflowY: 'auto',
  },
  table: {
    tableLayout: 'fixed',
  },
  toolbar: {
    marginLeft: 'auto',
  },
}))

function getColumnType(
  columnPath: JSONPointer.Path,
  jsonDict: Record<string, JsonValue>,
  parent?: JsonValue,
) {
  // TODO: use `getJsonDictItemRecursively`
  const columnSchema = getJsonDictValue(columnPath, jsonDict)
  if (columnSchema && !parent) return columnSchema.type as JSONType

  if (Array.isArray(parent)) return 'array'

  if (!columnSchema) return 'object'

  return typeof parent as JSONType
}

const useEmptyColumnStyles = M.makeStyles((t) => ({
  root: {
    border: `1px solid ${t.palette.grey[400]}`,
    padding: t.spacing(1),
  },
}))

interface EmptyColumnProps {
  columnType?: JSONType
}

function EmptyColumn({ columnType }: EmptyColumnProps) {
  const classes = useEmptyColumnStyles()

  if (columnType !== 'array') return null

  return (
    <M.TableRow className={classes.root}>
      <M.TableCell colSpan={2}>
        This array is empty. Add the first item or create array at the parent level
      </M.TableCell>
    </M.TableRow>
  )
}

const MIN_ROWS_NUMBER = 10

interface ColumnFillerProps {
  hasSiblingColumn: boolean
  filledRowsNumber: number
}

function ColumnFiller({ hasSiblingColumn, filledRowsNumber }: ColumnFillerProps) {
  const emptyRows = React.useMemo(() => {
    if (filledRowsNumber >= MIN_ROWS_NUMBER) return []
    return R.range(0, MIN_ROWS_NUMBER - filledRowsNumber)
  }, [filledRowsNumber])

  if (!hasSiblingColumn) return null

  return (
    <>
      {emptyRows.map((index) => (
        <EmptyRow key={`empty_row_${index}`} />
      ))}
    </>
  )
}

interface ColumnProps {
  hasSiblingColumn: boolean
  className: string
  columnPath: JSONPointer.Path
  contextMenuPath: JSONPointer.Path
  data: {
    items: RowData[]
    parent?: JsonValue
  }
  jsonDict: Record<string, JsonValue>
  mode?: EditorMode
  onAddRow: (path: JSONPointer.Path, key: string | number, value: JsonValue) => void
  onBreadcrumb: (path: JSONPointer.Path) => void
  onChange: (path: JSONPointer.Path, id: 'key' | 'value', value: JsonValue) => void
  onContextMenu: (path: JSONPointer.Path) => void
  onExpand: (path: JSONPointer.Path) => void
  onRemove: (path: JSONPointer.Path) => void
  onToolbar: (func: (v: JsonRecord) => JsonRecord) => void
}

export default function Column({
  className,
  columnPath,
  contextMenuPath,
  data,
  hasSiblingColumn,
  jsonDict,
  mode = 'default',
  onAddRow,
  onBreadcrumb,
  onChange,
  onContextMenu,
  onExpand,
  onRemove,
  onToolbar,
}: ColumnProps) {
  const columns = React.useMemo(
    () =>
      [
        {
          accessor: COLUMN_IDS.KEY,
        },
        {
          accessor: COLUMN_IDS.VALUE,
        },
      ] as RTable.Column<RowData>[],
    [],
  )

  const classes = useStyles()
  const rootRef = React.useRef<HTMLDivElement>(null)
  const { width = 0 } = useResizeObserver({ ref: rootRef })
  // the column's own width, not the viewport (DESIGN.md Column Rule)
  const cards = mode === 'property' && width > 0 && width < CARDS_BELOW

  const [hasNewRow, setHasNewRow] = React.useState(false)
  // TODO: rename to less tutorial-ish name
  const updateMyData = React.useCallback(
    (path: JSONPointer.Path, id: 'key' | 'value', value: JsonValue) => {
      setHasNewRow(false)
      onChange(path, id, value)
    },
    [onChange],
  )

  const tableInstance = RTable.useTable({
    columns,
    data: data.items,
    defaultColumn: {
      Cell,
    },
    updateMyData,
  })
  const { getTableProps, getTableBodyProps, rows, prepareRow } = tableInstance

  const columnType = getColumnType(columnPath, jsonDict, data.parent)

  const onAddRowInternal = React.useCallback(
    (path: JSONPointer.Path, key: string | number, value: JsonValue) => {
      setHasNewRow(true)
      onAddRow(path, key, value)
    },
    [onAddRow],
  )

  const toolbar = Toolbar.use()

  return (
    <div
      className={cx(
        classes.root,
        { [classes.sibling]: hasSiblingColumn, [classes.cards]: cards },
        className,
      )}
      ref={rootRef}
    >
      {!!columnPath.length && (
        <div className={classes.breadcrumbs}>
          <Breadcrumbs
            tailOnly={hasSiblingColumn}
            items={columnPath}
            onSelect={onBreadcrumb}
          />
          {toolbar && (
            <div className={classes.toolbar}>
              <toolbar.Toolbar columnPath={columnPath} onChange={onToolbar} />
            </div>
          )}
        </div>
      )}

      <M.TableContainer className={cx({ [classes.scroll]: hasSiblingColumn })}>
        <M.Table {...getTableProps({ className: classes.table })}>
          {mode === 'property' && (
            <M.TableHead>
              <M.TableRow>
                {['Field', 'Value', 'Type', 'About'].map((h) => (
                  <M.TableCell className={classes.head} key={h}>
                    {h}
                  </M.TableCell>
                ))}
              </M.TableRow>
            </M.TableHead>
          )}
          <M.TableBody {...getTableBodyProps()}>
            {rows.map((row, index: number) => {
              const isLastRow = index === rows.length - 1

              prepareRow(row)

              const props = {
                cells: row.cells,
                columnPath,
                contextMenuPath,
                fresh: isLastRow && hasNewRow,
                mode,
                onContextMenu,
                onExpand,
                onRemove,
              }

              return <Row {...row.getRowProps()} {...props} key={row.original.reactId} />
            })}

            {!rows.length && <EmptyColumn columnType={columnType} />}

            {columnType === 'array' && (
              <AddArrayItem
                {...{
                  className: hasSiblingColumn ? classes.siblingButton : undefined,
                  columnPath,
                  index: rows.length,
                  onAdd: onAddRowInternal,
                  key: `add_array_item_${rows.length}`,
                }}
              />
            )}

            {columnType !== 'array' && (
              <AddRow
                {...{
                  columnPath,
                  contextMenuPath,
                  key: `add_row_${rows.length}`,
                  onAdd: onAddRowInternal,
                  onContextMenu,
                  onExpand,
                }}
              />
            )}

            {columnType !== 'array' && (
              <ColumnFiller
                hasSiblingColumn={hasSiblingColumn}
                filledRowsNumber={rows.length}
              />
            )}
          </M.TableBody>
        </M.Table>
      </M.TableContainer>
    </div>
  )
}
