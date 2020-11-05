import isArray from 'lodash/isArray'
import * as React from 'react'
import { useTable } from 'react-table'
import * as M from '@material-ui/core'

import AddArrayItem from './AddArrayItem'
import AddRow from './AddRow'
import Breadcrumbs from './Breadcrumbs'
import Cell from './Cell'
import Row from './Row'
import { COLUMN_IDS, EMPTY_VALUE } from './State'

const useStyles = M.makeStyles((t) => ({
  root: {
    background: t.palette.common.white,
    flex: 'none',
    padding: '1px 0', // NOTE: fit 2px border for input
    width: '100%',
    '& + $root': {
      marginLeft: -1,
    },
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

export default function Column({
  columnPath,
  data,
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

              if (
                row.values &&
                row.values[COLUMN_IDS.KEY] !== EMPTY_VALUE &&
                row.values[COLUMN_IDS.VALUE] !== EMPTY_VALUE
              ) {
                const key = row.values[COLUMN_IDS.KEY]
                const value = row.values[COLUMN_IDS.VALUE]
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
    </div>
  )
}
