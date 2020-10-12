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
    borderTop: `1px solid ${t.palette.divider}`,
    width: '100%',
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

const useBreadcrumbsStyles = M.makeStyles((t) => ({
  root: {
    alignItems: 'center',
    borderBottom: `1px solid ${t.palette.divider}`,
    display: 'flex',
    height: '49px',
    padding: t.spacing(1),
  },

  item: {
    display: 'flex',
  },
  divider: {
    marginLeft: t.spacing(0.5),
    marginRight: t.spacing(0.5),
  },
  back: {
    marginRight: t.spacing(2),
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
  onMenuOpen,
  onMenuSelect,
  row,
  updateMyData,
  value: initialValue,
}) {
  const classes = useInputStyles()

  const inputRef = React.useRef(null)
  const [value, setValue] = React.useState(initialValue)
  const [menuOpened, setMenuOpened] = React.useState(false)

  const fieldPath = columnPath.concat(row.values[ColumnIds.Key])

  const onChange = React.useCallback(
    (event) => {
      setValue(event.target.value)
      updateMyData(fieldPath, event.target.value) // FIXME: add columnId too
    },
    [fieldPath, setValue, updateMyData],
  )

  const openMenu = React.useCallback(() => {
    setMenuOpened(true)
    onMenuOpen(fieldPath, column.id)
  }, [column, fieldPath, onMenuOpen, setMenuOpened])

  const closeMenu = React.useCallback(() => setMenuOpened(false), [setMenuOpened])
  // const hasMenu = React.useMemo(() => {
  //   if (!menu) return false
  //   return (
  //     row.id.toString() === menu.address.rowIndex.toString() &&
  //     column.id.toString() === menu.address.columnId.toString()
  //   )
  // }, [row, column, menu])

  const ExpandButton = (
    <M.InputAdornment className={classes.expand} onClick={() => onExpand(fieldPath)}>
      <M.Icon>arrow_right</M.Icon>
    </M.InputAdornment>
  )

  const MenuButton = (
    <M.InputAdornment className={classes.menu} onClick={openMenu}>
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

      {menuOpened && (
        <CellMenu
          inputRef={inputRef}
          menu={menu}
          onClick={onMenuSelect}
          onClose={closeMenu}
        />
      )}
    </>
  )
}

function CellMenu({ inputRef, menu, onClose, onClick }) {
  return (
    <M.Menu open anchorEl={inputRef.current} onClose={onClose}>
      {menu.map((key) => (
        <M.MenuItem key={key} onClick={() => onClick(key)}>
          {key}
        </M.MenuItem>
      ))}
    </M.Menu>
  )
}

function Breadcrumbs({ items, onBack }) {
  const classes = useBreadcrumbsStyles()
  const ref = React.useRef()
  React.useEffect(() => {
    ref.current.scrollIntoView()
  })

  return (
    <div className={classes.root} ref={ref}>
      <M.Icon className={classes.back} onClick={onBack}>
        arrow_back
      </M.Icon>

      {items.map((item, index) => {
        const key = `${item}_${index}`
        return (
          <div key={key} className={classes.item}>
            <M.Typography variant="subtitle2">{item}</M.Typography>
            {index !== items.length - 1 && (
              <M.Icon className={classes.divider} fontSize="small">
                chevron_right
              </M.Icon>
            )}
          </div>
        )
      })}
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
  onClick,
  onMenuOpen,
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
                        })}
                      </M.TableCell>
                    ))}
                  </M.TableRow>
                )
              })}
              <M.TableRow>
                <M.TableCell className={classes.tableCell}>
                  <KeyCell
                    columnPath={columnPath}
                    menu={menu}
                    onClick={onClick}
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
                  <KeyCell
                    columnPath={columnPath}
                    menu={menu}
                    onClick={onClick}
                    onExpand={onExpand}
                    onMenuOpen={onMenuOpen}
                    onMenuSelect={onMenuSelect}
                    updateMyData={updateMyData}
                    column={{
                      id: ColumnIds.Value,
                    }}
                    value=""
                    row={{
                      index: rows.length + 1,
                      values: {
                        [ColumnIds.Key]: '',
                        [ColumnIds.Value]: '',
                      },
                    }}
                  />
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

  const {
    changeValue,
    columns: data,
    fieldPath,
    menu,
    openKeyMenu,
    setFieldPath,
  } = useJson(initialData, initialSchema)

  // FIXME: should be different for key and value
  const updateMyData = React.useCallback(changeValue, [changeValue])

  const onMenuOpen = React.useCallback(
    (contextFieldPath, columnId) => {
      if (columnId === ColumnIds.Key) {
        openKeyMenu(contextFieldPath)
      }

      // if (columnId === ColumnIds.Column) {
      // }
    },
    [openKeyMenu],
  )

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

  const onExpand = React.useCallback(setFieldPath, [setFieldPath])

  const onCollapse = React.useCallback(() => {
    setFieldPath(R.init(fieldPath))
  }, [fieldPath, setFieldPath])

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
            menu={menu}
            onClick={onClick}
            onExpand={onExpand}
            onCollapse={onCollapse}
            onMenuOpen={onMenuOpen}
            onMenuSelect={onMenuSelect}
            updateMyData={updateMyData}
          />
        )
      })}
    </div>
  )
}
