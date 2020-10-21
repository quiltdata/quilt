import * as React from 'react'
import * as R from 'ramda'
import cx from 'classnames'
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

  const tableInstance = useTable({
    columns,
    data: data.items,

    defaultColumn: {
      Cell,
    },

    updateMyData,
  })
  const { getTableProps, getTableBodyProps, rows, prepareRow } = tableInstance

  const columnType = R.pathOr('object', ['schema', 'type'], data)

  return (
    <div className={cx(classes.root)}>
      {Boolean(columnPath.length) && (
        <Breadcrumbs items={columnPath} onBack={onCollapse} />
      )}

      <M.Fade in>
        <M.TableContainer>
          <M.Table aria-label="simple table" {...getTableProps()}>
            <M.TableBody {...getTableBodyProps()}>
              {rows.map((row) => {
                prepareRow(row)

                return (
                  <Row
                    {...row.getRowProps()}
                    {...{
                      cells: row.cells,
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
                    onAdd: onAddRow,
                  }}
                />
              ) : (
                <AddRow
                  {...{
                    columnPath,
                    keysList: rows.length ? rows[0].original.keysList : [],
                    onExpand,
                    onAdd: onAddRow,
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
