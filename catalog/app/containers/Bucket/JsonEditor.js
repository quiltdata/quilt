import cx from 'classnames'
import * as R from 'ramda'
import * as React from 'react'
import { useTable } from 'react-table'
import isObject from 'lodash/isObject'
import isArray from 'lodash/isArray'

import * as M from '@material-ui/core'

import useJson, { ColumnIds } from 'utils/json'

const i18nMsgs = {
  key: 'Key',
  value: 'Value',
}

const useStyles = M.makeStyles((t) => ({
  root: {
    background: '#fff',
    width: t.spacing(60),
    flex: 'none',

    '& + $root': {
      borderLeft: `1px solid ${t.palette.divider}`,
    },
  },

  tableCell: {
    padding: 0,
  },
}))

const useWrapperStyles = M.makeStyles(() => ({
  root: {
    display: 'flex',
    overflowX: 'auto',
  },
}))

const useInputStyles = M.makeStyles((t) => ({
  root: {
    padding: t.spacing(1),
    width: '100%',
  },

  expand: {
    cursor: 'pointer',
  },

  menu: {
    cursor: 'pointer',
  },

  rootKey: {
    borderRight: `1px solid ${t.palette.divider}`,
  },
}))

const initialSchema = {
  type: 'object',
  properties: {
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
      },
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

function formatValuePreview(x) {
  if (isObject(x)) {
    return `{ ${Object.keys(x).join(', ')} }`
  }

  if (isArray(x)) {
    return `[ ${x.toString()} ]`
  }

  return x
}

function KeyCell({
  column,
  columnPath,
  menu,
  onClick,
  onExpand,
  onMenuClose,
  onMenuOpen,
  onMenuSelect,
  row,
  updateMyData,
  value: initialValue,
}) {
  const classes = useInputStyles()

  const inputRef = React.useRef(null)
  const [value, setValue] = React.useState(initialValue)

  const onChange = React.useCallback(
    (event) => {
      setValue(event.target.value)
      updateMyData(row.index, column.id, event.target.value)
    },
    [column, row.index, updateMyData],
  )

  const hasMenu = React.useMemo(() => {
    if (!menu) return false
    return (
      row.id.toString() === menu.address.rowIndex.toString() &&
      column.id.toString() === menu.address.columnId.toString()
    )
  }, [row, column, menu])

  const fieldPath = columnPath.concat(row.values[ColumnIds.Key])

  const ExpandButton = (
    <M.InputAdornment className={classes.expand} onClick={() => onExpand(fieldPath)}>
      <M.Icon>arrow_right</M.Icon>
    </M.InputAdornment>
  )

  const MenuButton = (
    <M.InputAdornment
      className={classes.menu}
      onClick={() => onMenuOpen(row.index, column.id, value)}
    >
      <M.Icon>arrow_drop_down</M.Icon>
    </M.InputAdornment>
  )

  return (
    <>
      <M.InputBase
        ref={inputRef}
        startAdornment={isObject(value) && ExpandButton}
        endAdornment={MenuButton}
        className={cx(classes.root, {
          [classes.rootKey]: column.id === ColumnIds.Key,
          [classes.rootValue]: column.id === ColumnIds.Value,
        })}
        value={formatValuePreview(value)}
        onChange={onChange}
        onClick={() => onClick(row.index, column.id, value)}
        placeholder={
          {
            [ColumnIds.Key]: i18nMsgs.key,
            [ColumnIds.Value]: i18nMsgs.value,
          }[column.id]
        }
      />

      {hasMenu && (
        <CellMenu
          inputRef={inputRef}
          menu={menu}
          onClick={onMenuSelect}
          onClose={onMenuClose}
        />
      )}
    </>
  )
}

function CellMenu({ inputRef, menu, onClose, onClick }) {
  return (
    <M.Menu open anchorEl={inputRef.current} onClose={onClose}>
      {menu.items.map((row) => (
        <M.MenuItem key={row[ColumnIds.Key]} onClick={() => onClick(row, menu)}>
          {row[ColumnIds.Key]}
        </M.MenuItem>
      ))}
    </M.Menu>
  )
}

function Table({
  columnPath,
  columns,
  data,
  menu,
  onExpand,
  onClick,
  onMenuOpen,
  onMenuClose,
  onMenuSelect,
  updateMyData,
}) {
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
                      {cell.render('Cell', {
                        columnPath,
                        menu,
                        onClick, // TODO: onCellSelect
                        onExpand,
                        onMenuOpen,
                        onMenuSelect,
                        onMenuClose,
                      })}
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

export default function JsonEditor() {
  const classes = useWrapperStyles()

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

  const { columns: data, fieldPath, setFieldPath } = useJson(initialData, initialSchema)

  const [menu, setMenu] = React.useState({ address: {}, items: [] })

  const closeMenu = React.useCallback(() => setMenu({ address: {}, items: [] }), [
    setMenu,
  ])

  const updateMyData = () => {}
  // const updateMyData = React.useCallback(
  //   (nestingLevel, rowIndex, columnId, value) => {
  //     const begining = data.slice(0, rowIndex)
  //     const end = data.slice(rowIndex + 1)
  //     // setData([
  //     //   [
  //     //     begining,
  //     //     {
  //     //       [columnId]: value,
  //     //       ...data[rowIndex],
  //     //     },
  //     //     end,
  //     //   ],
  //     // ])
  //   },
  //   [data],
  // )

  const onMenuOpen = React.useCallback(
    (nestingLevel, rowIndex, columnId) => {
      if (columnId === ColumnIds.Key) {
        setMenu({
          address: {
            nestingLevel,
            rowIndex,
            columnId,
          },
          items: data[nestingLevel],
        })
      }

      // if (columnId === ColumnIds.Column) {
      // }
    },
    [data],
  )

  const onMenuClose = React.useCallback(() => closeMenu, [closeMenu])

  const onMenuSelect = () => {}
  // const onMenuSelect = React.useCallback(
  //   (row, { address }) => {
  //     // setData(
  //     //   R.assocPath(
  //     //     [address.nestingLevel, address.rowIndex],
  //     //     {
  //     //       [ColumnIds.Key]: row[ColumnIds.Key],
  //     //       [ColumnIds.Value]: row[ColumnIds.Value],
  //     //     },
  //     //     data,
  //     //   ),
  //     // )
  //     closeMenu()
  //   },
  //   [data, closeMenu],
  // )

  const onClick = () => {}

  const onExpand = React.useCallback(
    (newFieldPath) => {
      setFieldPath(newFieldPath)
    },
    [setFieldPath],
  )

  return (
    <div className={classes.root}>
      {data.map((columnData, index) => {
        const tableKey = `nestingLevel${index}`
        return (
          <Table
            columnPath={R.slice(0, index, fieldPath)}
            columns={columns}
            data={columnData}
            key={tableKey}
            menu={menu.address.nestingLevel === index ? menu : null}
            onClick={onClick}
            onExpand={onExpand}
            onMenuClose={onMenuClose}
            onMenuOpen={(...args) => onMenuOpen(index, ...args)}
            onMenuSelect={onMenuSelect}
            updateMyData={(...args) => updateMyData.bind(index, ...args)}
          />
        )
      })}
    </div>
  )
}
