import * as React from 'react'
import { useTable } from 'react-table'
import * as M from '@material-ui/core'

import AddArrayItem from './AddArrayItem'
import AddRow from './AddRow'
import Breadcrumbs from './Breadcrumbs'
import Cell from './Cell'
import Row from './Row'
import { COLUMN_IDS, getJsonDictValue } from './State'

const useStyles = M.makeStyles((t) => ({
  root: {
    background: t.palette.common.white,
    flex: 'none',
    padding: '1px 0', // NOTE: fit 2px border for input
    position: 'relative',
    width: '100%',
  },
}))

function getColumntType(columnPath, jsonDict, parent) {
  const columnSchema = getJsonDictValue(columnPath, jsonDict)
  if (!parent) return columnSchema.type

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

function EmptyColumn({ columnType }) {
  const classes = useEmptyColumnStyles()

  if (columnType !== 'array') return null

  return (
    <M.TableRow className={classes.root}>
      <M.TableCell colSpan={2}>This array is empty, click above to edit</M.TableCell>
    </M.TableRow>
  )
}

export default function Column({
  columnPath,
  data,
  jsonDict,
  onAddRow,
  onBreadcrumb,
  onExpand,
  onMenuAction,
  onChange,
}) {
  const columns = React.useMemo(
    () => [
      {
        accessor: COLUMN_IDS.KEY,
      },
      {
        accessor: COLUMN_IDS.VALUE,
      },
    ],
    [],
  )

  const classes = useStyles()

  const [hasNewRow, setHasNewRow] = React.useState(false)
  const onChangeInternal = React.useCallback(
    (...params) => {
      setHasNewRow(false)
      onChange(...params)
    },
    [onChange],
  )

  const tableInstance = useTable({
    columns,
    data: data.items,
    defaultColumn: {
      Cell,
    },
    updateMyData: onChangeInternal,
  })
  const { getTableProps, getTableBodyProps, rows, prepareRow } = tableInstance

  const columnType = getColumntType(columnPath, jsonDict, data.parent)

  const onAddRowInternal = React.useCallback(
    (...params) => {
      setHasNewRow(true)
      onAddRow(...params)
    },
    [onAddRow],
  )

  return (
    <div className={classes.root}>
      {!!columnPath.length && <Breadcrumbs items={columnPath} onSelect={onBreadcrumb} />}

      <M.TableContainer>
        <M.Table {...getTableProps()}>
          <M.TableBody {...getTableBodyProps()}>
            {rows.map((row, index) => {
              const isLastRow = index === rows.length - 1

              prepareRow(row)

              const props = {
                cells: row.cells,
                fresh: isLastRow && hasNewRow,
                columnPath,
                onExpand,
                onMenuAction,
              }

              if (row.original && row.original.reactId) {
                props.key = row.original.reactId
              }

              return <Row {...row.getRowProps()} {...props} />
            })}

            {!rows.length && <EmptyColumn columnType={columnType} />}

            {columnType === 'array' && !!rows.length && (
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
