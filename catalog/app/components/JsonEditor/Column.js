import * as React from 'react'
import cx from 'classnames'
import isArray from 'lodash/isArray'
import { useTable } from 'react-table'

import * as M from '@material-ui/core'

import AddArrayItem from './AddArrayItem'
import AddRow from './AddRow'
import Breadcrumbs from './Breadcrumbs'
import Cell from './Cell'
import Row from './Row'
import { ColumnIds } from './State'

const useStyles = M.makeStyles((t) => ({
  root: {
    background: '#fff',
    width: '100%',
    flex: 'none',

    '& + $root': {
      marginLeft: -1,
    },
  },

  selected: {
    backgroundColor: t.palette.action.focus,
  },
}))

function getColumntType({ parent }) {
  // NOTE: also you can get schema type here
  //       `R.path(['schema', 'type'], schema)`

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
    <div className={cx(classes.root)}>
      {Boolean(columnPath.length) && (
        <Breadcrumbs items={columnPath} onBack={onCollapse} />
      )}

      <M.Fade in>
        <M.TableContainer>
          <M.Table aria-label="simple table" {...getTableProps()}>
            <M.TableBody {...getTableBodyProps()}>
              {rows.map((row, index) => {
                const isLastRow = index === rows.length - 1

                prepareRow(row)

                return (
                  <Row
                    {...row.getRowProps()}
                    {...{
                      cells: row.cells,
                      fresh: isLastRow && hasNewRow,
                      columnPath,
                      onExpand,
                      onMenuAction,
                    }}
                  />
                )
              })}

              {columnType === 'array' ? (
                <AddArrayItem
                  {...{
                    columnPath,
                    index: rows.length,
                    onAdd: onAddRowInternal,
                  }}
                />
              ) : (
                <AddRow
                  {...{
                    columnPath,
                    keysList: rows.length ? rows[0].original.keysList : [],
                    onExpand,
                    onAdd: onAddRowInternal,
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
