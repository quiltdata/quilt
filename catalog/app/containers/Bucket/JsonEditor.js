import cx from 'classnames'
import * as R from 'ramda'
import * as React from 'react'
import { useTable } from 'react-table'
import isObject from 'lodash/isObject'
import isArray from 'lodash/isArray'

import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

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
    width: '225px',
  },

  selected: {
    backgroundColor: t.palette.action.focus,
  },
}))

const useWrapperStyles = M.makeStyles((t) => ({
  root: {
    marginTop: t.spacing(1),
  },
  inner: {
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
    margin: `0 ${t.spacing(1)}px 0 0`,
  },

  menu: {
    cursor: 'pointer',
    color: t.palette.divider,
  },

  rootKey: {
    borderRight: `1px solid ${t.palette.divider}`,
  },

  wrapper: {},
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
    cursor: 'pointer',
    marginRight: t.spacing(2),
  },
}))

const useErrorsStyles = M.makeStyles((t) => ({
  root: {
    marginTop: t.spacing(1),
  },
}))

const usePreviewClasses = M.makeStyles((t) => ({
  root: {
    alignItems: 'center',
    borderRight: `1px solid ${t.palette.divider}`,
    display: 'flex',
    height: '48px',
    padding: '8px',
    width: '100%',
  },

  value: {
    flexGrow: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    width: '219px',
  },
}))

const useExpandClasses = M.makeStyles((t) => ({
  root: {
    cursor: 'pointer',
    margin: `0 ${t.spacing(1)}px 0 0`,
  },
}))

const useMenuClasses = M.makeStyles((t) => ({
  root: {
    cursor: 'pointer',
    color: t.palette.divider,
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

function formatValuePreview(x) {
  if (isArray(x)) {
    return `[ ${x.map(formatValuePreview)} ]`
  }

  if (isObject(x)) {
    return `{ ${Object.keys(x).join(', ')} }`
  }

  return x
}

function ExpandButton({ onClick }) {
  const classes = useExpandClasses()

  return (
    <M.InputAdornment className={classes.root} onClick={onClick}>
      <M.Icon fontSize="small">arrow_right</M.Icon>
    </M.InputAdornment>
  )
}

function MenuButton({ onClick }) {
  const classes = useMenuClasses()
  return (
    <M.InputAdornment className={classes.root} onClick={onClick}>
      <M.Icon fontSize="small">arrow_drop_down</M.Icon>
    </M.InputAdornment>
  )
}

function ValuePreview({ expandable, value, onExpand, onMenu }) {
  const classes = usePreviewClasses()
  return (
    <div className={classes.root}>
      {expandable && <ExpandButton onClick={onExpand} />}
      <div className={classes.value}>
        <span className={classes.valueInner}>{value}</span>
      </div>
      <MenuButton onClick={onMenu} />
    </div>
  )
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

  const menuAnchorRef = React.useRef(null)
  const inputRef = React.useRef(null)
  const [value, setValue] = React.useState(initialValue)
  const [menuOpened, setMenuOpened] = React.useState(false)
  const [editing, setEditing] = React.useState(false)

  const key = row.values[ColumnIds.Key]
  const fieldPath = React.useMemo(() => columnPath.concat(key), [columnPath, key])

  const onChange = React.useCallback(
    (event) => {
      setValue(event.target.value)
    },
    [setValue],
  )

  const onBlur = React.useCallback(() => {
    setValue(JSON.parse(value))
    updateMyData(fieldPath, column.id, JSON.parse(value))
    setEditing(false)
  }, [column.id, fieldPath, setValue, value, updateMyData])

  const openMenu = React.useCallback(() => {
    setMenuOpened(true)
    onMenuOpen(fieldPath, column.id)
  }, [column, fieldPath, onMenuOpen, setMenuOpened])

  const onFocus = React.useCallback(() => {
    setValue(JSON.stringify(value))
  }, [setValue, value])

  const closeMenu = React.useCallback(() => setMenuOpened(false), [setMenuOpened])

  const onDoubleClick = React.useCallback(() => {
    setEditing(true)
  }, [setEditing])

  React.useEffect(() => {
    if (editing) {
      inputRef.current.focus()
    }
  }, [editing, inputRef])

  // disabled={column.id === ColumnIds.Key && initialValue !== ''}

  return (
    <div
      onDoubleClick={onDoubleClick}
      className={cx({
        [classes.wrapper]: !editing,
      })}
    >
      <div ref={menuAnchorRef}>
        {editing ? (
          <M.InputBase
            disabled={!editing}
            inputRef={inputRef}
            startAdornment={
              isObject(value) && <ExpandButton onClick={() => onExpand(fieldPath)} />
            }
            endAdornment={<MenuButton onClick={openMenu} />}
            className={cx(classes.root, {
              [classes.rootKey]: column.id === ColumnIds.Key,
              [classes.rootValue]: column.id === ColumnIds.Value,
            })}
            value={formatValuePreview(value)}
            onChange={onChange}
            onBlur={onBlur}
            onFocus={onFocus}
            onClick={() => onClick(row.index, column.id, value)}
            placeholder={
              {
                [ColumnIds.Key]: i18nMsgs.key,
                [ColumnIds.Value]: i18nMsgs.value,
              }[column.id]
            }
          />
        ) : (
          <ValuePreview
            expandable={isObject(value)}
            onExpand={() => onExpand(fieldPath)}
            onMenu={openMenu}
            value={formatValuePreview(value)}
          />
        )}
      </div>

      {menuOpened && (
        <CellMenu
          inputRef={menuAnchorRef}
          menu={menu}
          onClick={onMenuSelect}
          onClose={closeMenu}
        />
      )}
    </div>
  )
}

function Row({
  row,
  columnPath,
  menu,
  onClick, // TODO: onCellSelect
  onExpand,
  onMenuOpen,
  onMenuSelect,
}) {
  const classes = useStyles()

  const [selected, setSelected] = React.useState(false)

  return (
    <M.ClickAwayListener onClickAway={() => setSelected(false)}>
      <M.TableRow
        className={cx({ [classes.selected]: selected })}
        onClick={() => setSelected(true)}
      >
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
    </M.ClickAwayListener>
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
                  <Row
                    {...row.getRowProps()}
                    row={row}
                    columnPath={columnPath}
                    menu={menu}
                    onClick={onClick}
                    onExpand={onExpand}
                    onMenuOpen={onMenuOpen}
                    onMenuSelect={onMenuSelect}
                  />
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
      <div className={classes.inner}>
        {data.map((columnData, index) => {
          const tableKey = columnData.map(({ key }) => key).join()
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

      <Errors errors={errors} />
    </div>
  )
}
