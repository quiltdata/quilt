import cx from 'classnames'
import * as React from 'react'
import { useTable } from 'react-table'
import isObject from 'lodash/isObject'
import isArray from 'lodash/isArray'

import * as M from '@material-ui/core'

const ColumnIds = {
  Key: 'key',
  Value: 'value',
}

const useStyles = M.makeStyles(() => ({
  root: {
    background: '#fff',
  },

  tableCell: {
    padding: 0,
  },
}))

const useInputStyles = M.makeStyles((t) => ({
  root: {
    width: '100%',
  },
  rootKey: {
    borderRight: `1px solid ${t.palette.divider}`,
  },
}))

const initialData = {
  version: 'v0',
  message: 'Initial commit, really with',
  user_meta: {
    id: '001',
    type: 'donut',
    name: 'Cake',
    ppu: 0.55,
    batters: {
      batter: [
        {
          id: '1001',
          type: 'Regular',
        },
        {
          id: '1002',
          type: 'Chocolate',
        },
      ],
    },
    topping: [],
  },
}

function formatValuePreview(x) {
  if (isObject(x)) {
    return `{ ${Object.keys(x).join(', ')} }`
  }

  if (isArray(x)) {
    return `[ ${x.toString()} ]`
  }

  return x
}

function KeyCell({ updateMyData, value: initialValue, row, column }) {
  const classes = useInputStyles()

  const [value, setValue] = React.useState(initialValue)

  const onChange = React.useCallback(
    (event) => {
      setValue(event.target.value)
      updateMyData(row.index, column.id, event.target.value)
    },
    [column, row.index, updateMyData],
  )

  return (
    <M.TextField
      InputProps={{
        endAdornment: (
          <M.InputAdornment>
            <M.Icon>arrow_drop_down</M.Icon>
          </M.InputAdornment>
        ),
      }}
      className={cx(classes.root, {
        [classes.rootKey]: column.id === ColumnIds.Key,
        [classes.rootValue]: column.id === ColumnIds.Value,
      })}
      value={formatValuePreview(value)}
      onChange={onChange}
    />
  )
}

function Table({ data, columns, updateMyData }) {
  const classes = useStyles()

  const tableInstance = useTable({
    columns,
    data,

    defaultColumn: {
      Cell: KeyCell,
    },

    updateMyData,
  })

  const { getTableProps, getTableBodyProps, rows, prepareRow } = tableInstance

  return (
    <div className={cx(classes.root)}>
      <M.TableContainer>
        <M.Table className={classes.table} aria-label="simple table" {...getTableProps()}>
          <M.TableBody {...getTableBodyProps()}>
            {rows.map((row) => {
              prepareRow(row)
              return (
                <M.TableRow {...row.getRowProps()}>
                  {row.cells.map((cell) => (
                    <M.TableCell {...cell.getCellProps()} className={classes.tableCell}>
                      {cell.render('Cell')}
                    </M.TableCell>
                  ))}
                </M.TableRow>
              )
            })}
          </M.TableBody>
        </M.Table>
      </M.TableContainer>
    </div>
  )
}

function convertToTableData(rawData) {
  return Object.keys(rawData).map((key) => ({
    [ColumnIds.Key]: key,
    [ColumnIds.Value]: rawData[key],
  }))
}

export default function JsonEditor() {
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

  const [data, setData] = React.useState(convertToTableData(initialData))

  const updateMyData = React.useCallback(
    (rowIndex, columnId, value) => {
      const begining = data.slice(0, rowIndex)
      const end = data.slice(rowIndex + 1)
      setData([
        begining,
        {
          [columnId]: value,
          ...data[rowIndex],
        },
        end,
      ])
    },
    [data, setData],
  )

  return <Table data={data} columns={columns} updateMyData={updateMyData} />
}
