import * as React from 'react'
import * as RTable from 'react-table'
import * as M from '@material-ui/core'

import AddArrayItem from './AddArrayItem'
import AddRow from './AddRow'
import Breadcrumbs from './Breadcrumbs'
import Cell from './Cell'
import Row from './Row'
import { getJsonDictValue } from './State'
import { COLUMN_IDS, JsonValue, RowData } from './constants'

const useStyles = M.makeStyles((t) => ({
  root: {
    background: t.palette.common.white,
    flex: 'none',
    padding: '1px 0', // NOTE: fit 2px border for input
    position: 'relative',
    width: '100%',
  },

  table: {
    tableLayout: 'fixed',
  },
}))

function getColumnType(
  columnPath: string[],
  jsonDict: Record<string, JsonValue>,
  parent: JsonValue,
) {
  const columnSchema = getJsonDictValue(columnPath, jsonDict)
  if (columnSchema && !parent) return columnSchema.type

  if (Array.isArray(parent)) return 'array'

  if (!columnSchema) return 'object'

  return typeof parent
}

const useEmptyColumnStyles = M.makeStyles((t) => ({
  root: {
    border: `1px solid ${t.palette.grey[400]}`,
    padding: t.spacing(1),
  },
}))

interface EmptyColumnProps {
  columnType: 'array' | 'object'
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

interface ColumnProps {
  columnPath: string[]
  data: {
    items: RowData[]
    parent: JsonValue
  }
  jsonDict: Record<string, JsonValue>
  onAddRow: (path: string[], key: string | number, value: JsonValue) => void
  onBreadcrumb: (path: string[]) => void
  onChange: (path: string[], id: 'key' | 'value', value: JsonValue) => void
  onExpand: (path: string[]) => void
  onRemove: (path: string[]) => void
}

export default function Column({
  columnPath,
  data,
  jsonDict,
  onAddRow,
  onBreadcrumb,
  onChange,
  onExpand,
  onRemove,
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

  const [hasNewRow, setHasNewRow] = React.useState(false)
  const onChangeInternal = React.useCallback(
    (path: string[], id: 'key' | 'value', value: JsonValue) => {
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
    updateMyData: onChangeInternal,
  })
  const { getTableProps, getTableBodyProps, rows, prepareRow } = tableInstance

  const columnType = getColumnType(columnPath, jsonDict, data.parent)

  const onAddRowInternal = React.useCallback(
    (path: string[], key: string | number, value: JsonValue) => {
      setHasNewRow(true)
      onAddRow(path, key, value)
    },
    [onAddRow],
  )

  return (
    <div className={classes.root}>
      {!!columnPath.length && <Breadcrumbs items={columnPath} onSelect={onBreadcrumb} />}

      <M.TableContainer>
        <M.Table {...getTableProps({ className: classes.table })}>
          <M.TableBody {...getTableBodyProps()}>
            {rows.map((row, index: number) => {
              const isLastRow = index === rows.length - 1

              prepareRow(row)

              const props = {
                cells: row.cells,
                fresh: isLastRow && hasNewRow,
                columnPath,
                onExpand,
                onRemove,
                key: '',
              }

              if (row.original.reactId) {
                props.key = row.original.reactId
              }

              return <Row {...row.getRowProps()} {...props} />
            })}

            {!rows.length && <EmptyColumn columnType={columnType} />}

            {columnType === 'array' && (
              <AddArrayItem
                {...{
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
                  onExpand,
                  onAdd: onAddRowInternal,
                  key: `add_row_${rows.length}`,
                }}
              />
            )}
          </M.TableBody>
        </M.Table>
      </M.TableContainer>
    </div>
  )
}
