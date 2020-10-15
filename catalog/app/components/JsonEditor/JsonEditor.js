import * as R from 'ramda'
import * as React from 'react'
import cx from 'classnames'
import objectHash from 'object-hash'
import { useTable } from 'react-table'

import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import AddRow from './AddRow'
import Breadcrumbs from './Breadcrumbs'
import Cell from './Cell'
import Row from './Row'
import useJson, { ColumnIds } from './State'

const useColumnStyles = M.makeStyles((t) => ({
  root: {
    background: '#fff',
    borderTop: `1px solid ${t.palette.divider}`,
    width: '100%',
    flex: 'none',

    '& + $root': {
      borderLeft: `1px solid ${t.palette.divider}`,
    },
  },

  selected: {
    backgroundColor: t.palette.action.focus,
  },

  tableCell: {
    padding: 0,
    width: '225px',
  },
}))

const useStyles = M.makeStyles((t) => ({
  root: {
    marginTop: t.spacing(1),
  },

  inner: {
    display: 'flex',
    overflowX: 'auto',
  },
}))

const useErrorsStyles = M.makeStyles((t) => ({
  root: {
    marginTop: t.spacing(1),
  },
}))

const initialSchema = {
  type: 'object',
  properties: {
    num: {
      type: 'number',
    },
    more: {
      type: 'string',
    },
    user_meta: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        type: { type: 'string' },
        name: { type: 'string' },
        ppu: { type: 'number' },
        batters: {
          type: 'object',
          properties: {
            batter: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  type: { type: 'string' },
                },
              },
            },
          },
        },
      },
      required: ['id', 'type', 'name', 'ppu', 'batters'],
    },
    message: {
      type: 'string',
    },
    version: {
      type: 'string',
    },
  },
  required: ['version', 'message', 'user_meta'],
}

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

function Errors({ errors }) {
  const classes = useErrorsStyles()

  return (
    <div className={classes.root}>
      {errors.map((error) => (
        <Lab.Alert severity="error" key={error.dataPath}>
          <code>`{error.dataPath}`</code>: {error.message}
        </Lab.Alert>
      ))}
    </div>
  )
}

function Table({
  columnPath,
  columns,
  data,
  onAddRow,
  onCollapse,
  onExpand,
  onMenuAction,
  onMenuSelect,
  updateMyData,
}) {
  const classes = useColumnStyles()

  const tableInstance = useTable({
    columns,
    data,

    defaultColumn: {
      Cell,
    },

    updateMyData,
  })
  const { getTableProps, getTableBodyProps, rows, prepareRow } = tableInstance

  return (
    <div className={cx(classes.root)}>
      {Boolean(columnPath.length) && (
        <Breadcrumbs items={columnPath} onBack={onCollapse} />
      )}

      <M.Fade in>
        <M.TableContainer>
          <M.Table
            className={classes.table}
            aria-label="simple table"
            {...getTableProps()}
          >
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
                      onMenuSelect,
                    }}
                  />
                )
              })}

              <AddRow
                {...{
                  columnPath,
                  onExpand,
                  onAdd: onAddRow,
                }}
              />
            </M.TableBody>
          </M.Table>
        </M.TableContainer>
      </M.Fade>
    </div>
  )
}

export default function JsonEditor() {
  const classes = useStyles()

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

  const {
    addRow,
    changeValue,
    columns: data,
    errors,
    fieldPath,
    makeAction,
    setFieldPath,
  } = useJson(initialData, initialSchema)

  const onMenuAction = React.useCallback(
    (contextFieldPath, action) => {
      makeAction(contextFieldPath, ColumnIds.Key, action)
    },
    [makeAction],
  )

  const onMenuSelect = React.useCallback(
    (contextFieldPath, value) => {
      changeValue(contextFieldPath, ColumnIds.Key, value)
    },
    [changeValue],
  )

  const onCollapse = React.useCallback(() => {
    setFieldPath(R.init(fieldPath))
  }, [fieldPath, setFieldPath])

  return (
    <div className={classes.root}>
      <div className={classes.inner}>
        {data.map((columnData, index) => (
          <Table
            {...{
              columnPath: R.slice(0, index, fieldPath),
              columns,
              data: columnData,
              key: objectHash(columnData),
              onAddRow: addRow,
              onCollapse,
              onExpand: setFieldPath,
              onMenuAction,
              onMenuSelect,
              updateMyData: changeValue,
            }}
          />
        ))}
      </div>

      <Errors errors={errors} />
    </div>
  )
}
