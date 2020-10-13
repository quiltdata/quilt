import * as R from 'ramda'
import * as React from 'react'
import cx from 'classnames'
import objectHash from 'object-hash'
import { useTable } from 'react-table'

import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import useJson, { ColumnIds } from 'utils/json'

import Breadcrumbs from './Breadcrumbs'
import Cell from './Cell'
import Row from './Row'

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
    version: {
      type: 'string',
    },
    message: {
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
  menu,
  onCollapse,
  onExpand,
  onMenuOpen,
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
                      menu,
                      onExpand,
                      onMenuOpen,
                      onMenuSelect,
                    }}
                  />
                )
              })}
              {/* TODO: AddRow component */}
              <M.TableRow>
                <M.TableCell className={classes.tableCell}>
                  <Cell
                    columnPath={columnPath}
                    menu={menu}
                    onExpand={onExpand}
                    onMenuOpen={onMenuOpen}
                    onMenuSelect={onMenuSelect}
                    updateMyData={updateMyData}
                    column={{
                      id: ColumnIds.Key,
                    }}
                    row={{
                      index: rows.length + 1,
                      values: {
                        [ColumnIds.Key]: '',
                        [ColumnIds.Value]: '',
                      },
                    }}
                    value=""
                  />
                </M.TableCell>
                <M.TableCell className={classes.tableCell}>
                  Add new key/value pair
                </M.TableCell>
              </M.TableRow>
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
    changeValue,
    columns: data,
    errors,
    fieldPath,
    menu,
    openKeyMenu,
    setFieldPath,
  } = useJson(initialData, initialSchema)

  const updateMyData = React.useCallback(changeValue, [changeValue])

  const onMenuOpen = React.useCallback(
    (contextFieldPath, columnId) => {
      if (columnId === ColumnIds.Key) {
        openKeyMenu(contextFieldPath)
      }
    },
    [openKeyMenu],
  )

  const onMenuSelect = React.useCallback(
    (contextFieldPath, value) => {
      changeValue(contextFieldPath, ColumnIds.Key, value)
    },
    [changeValue],
  )

  const onExpand = React.useCallback(setFieldPath, [setFieldPath])

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
              menu,
              onCollapse,
              onExpand,
              onMenuOpen,
              onMenuSelect,
              updateMyData,
            }}
          />
        ))}
      </div>

      <Errors errors={errors} />
    </div>
  )
}
