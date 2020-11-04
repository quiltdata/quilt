import * as React from 'react'
import isArray from 'lodash/isArray'
import { useTable } from 'react-table'

import * as M from '@material-ui/core'

import AddArrayItem from './AddArrayItem'
import AddRow from './AddRow'
import Breadcrumbs from './Breadcrumbs'
import Cell from './Cell'
import Row from './Row'
import { ColumnIds, EmptyValue } from './State'

const useStyles = M.makeStyles((t) => ({
  root: {
    background: '#fff',
    width: '100%',
    flex: 'none',
    '& + $root': {
      marginLeft: -1,
    },
  },
  tableContainer: {
    padding: '1px 0', // NOTE: fit 2px border for input
  },
  selected: {
    backgroundColor: t.palette.action.focus,
  },
}))

function getColumntType({ parent, schema }) {
  if (!parent) {
    return schema.type
  }

  if (isArray(parent)) {
    return 'array'
  }

  return typeof parent
}

export default function Table({
  columnPath,
  data,
  onAddRow,
  onCollapse,
  onExpand,
  onMenuAction,
  updateMyData,
}) {
  const columns = React.useMemo(
    () => [
      {
        accessor: ColumnIds.Key,
      },
      {
        accessor: ColumnIds.Value,
      },
    ],
    [],
  )

  const classes = useStyles()

  const [hasNewRow, setHasNewRow] = React.useState(false)
  const onChange = React.useCallback(
    (...params) => {
      setHasNewRow(false)
      updateMyData(...params)
    },
    [updateMyData],
  )

  const tableInstance = useTable({
    columns,
    data: data.items,

    defaultColumn: {
      Cell,
    },

    updateMyData: onChange,
  })
  const { getTableProps, getTableBodyProps, rows, prepareRow } = tableInstance

  const columnType = getColumntType(data)

  const onAddRowInternal = React.useCallback(
    (...params) => {
      setHasNewRow(true)
      onAddRow(...params)
    },
    [onAddRow],
  )

  return (
    <div className={classes.root}>
      {Boolean(columnPath.length) && (
        <Breadcrumbs items={columnPath} onBack={onCollapse} />
      )}

      <M.Fade in>
        <M.TableContainer className={classes.tableContainer}>
          <M.Table aria-label="simple table" {...getTableProps()}>
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

                if (
                  row.values &&
                  row.values[ColumnIds.Key] !== EmptyValue &&
                  row.values[ColumnIds.Value] !== EmptyValue
                ) {
                  const key = row.values[ColumnIds.Key]
                  const value = row.values[ColumnIds.Value]
                  props.key = `${columnPath}_key_${key}+value_${value}`
                }

                return <Row {...row.getRowProps()} {...props} />
              })}

              {columnType === 'array' ? (
                <AddArrayItem
                  {...{
                    columnPath,
                    index: rows.length,
                    onAdd: onAddRowInternal,
                    key: `add_array_item_${rows.length}`,
                  }}
                />
              ) : (
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
      </M.Fade>
    </div>
  )
}
