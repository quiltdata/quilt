import * as React from 'react'
import * as M from '@material-ui/core'

import { isSchemaEnum } from 'utils/json-schema'

import Input from './Input'
import Preview from './Preview'
import { Actions, ColumnIds, EmptyValue } from './State'

function CellMenu({ anchorRef, menu, onClose, onClick }) {
  if (!menu.length) return null

  return (
    <M.Menu anchorEl={anchorRef.current} onClose={onClose} open>
      {menu.map((subList) =>
        subList.key === 'divider' ? (
          <M.Divider key={subList.key} />
        ) : (
          <M.List
            subheader={
              subList.header && <M.ListSubheader>{subList.header}</M.ListSubheader>
            }
            key={subList.key}
          >
            {subList.options.map((item) => (
              <M.MenuItem
                key={`${item.action}_${item.title}`}
                onClick={() => onClick(item)}
              >
                <M.ListItemText primary={item.title} />
              </M.MenuItem>
            ))}
          </M.List>
        ),
      )}
    </M.Menu>
  )
}

function getMenuForKey({ required, value }) {
  const actionsOptions = [
    {
      action: Actions.RemoveField,
      title: 'Remove',
    },
  ]
  const actionsSubmenu = {
    key: 'actions',
    options: actionsOptions,
  }
  if (required || value === EmptyValue) {
    return []
  }
  return [actionsSubmenu]
}

function getMenuForValue({ valueSchema }) {
  const enumOptions = isSchemaEnum(valueSchema)
    ? valueSchema.enum.map((title) => ({
        action: Actions.SelectEnum,
        title,
      }))
    : []
  const enumSubmenu = {
    header: 'Enum',
    key: 'enum',
    options: enumOptions,
  }
  return enumOptions.length ? [enumSubmenu] : []
}

const useClasses = M.makeStyles((t) => ({
  root: {
    '&:focus': {
      outline: `1px solid ${t.palette.primary.light}`,
    },
  },
}))

export default function Cell({
  column,
  columnPath,
  onExpand,
  editing: editingInitial,
  onMenuAction,
  row,
  updateMyData,
  value: initialValue,
}) {
  const classes = useClasses()

  const menuAnchorRef = React.useRef(null)
  const [value, setValue] = React.useState(initialValue)

  const isEditable = React.useMemo(
    () => column.id === ColumnIds.Value || value === EmptyValue || !value,
    [column.id, value],
  )
  const [editing, setEditing] = React.useState(editingInitial)
  const [menuOpened, setMenuOpened] = React.useState(false)

  const key = row.values[ColumnIds.Key]
  const fieldPath = React.useMemo(() => columnPath.concat(key), [columnPath, key])

  const closeMenu = React.useCallback(() => setMenuOpened(false), [setMenuOpened])

  const onMenuOpen = React.useCallback(() => {
    setMenuOpened(true)
  }, [setMenuOpened])

  const onMenuSelect = React.useCallback(
    (menuItem) => {
      setMenuOpened(false)
      onMenuAction(fieldPath, menuItem)
    },
    [fieldPath, onMenuAction, setMenuOpened],
  )

  const onChange = React.useCallback(
    (newValue) => {
      setValue(newValue)
      updateMyData(fieldPath, column.id, newValue)
      setEditing(false)
    },
    [column.id, fieldPath, updateMyData],
  )

  const onDoubleClick = React.useCallback(() => {
    if (column.id === ColumnIds.Key && value !== EmptyValue) return
    setEditing(true)
  }, [column.id, value, setEditing])

  const onKeyPress = React.useCallback(
    (event) => {
      if (!editing) {
        event.preventDefault()
      }

      if (!isEditable) return
      if (event.key.length !== 1 && event.key !== 'Enter') return

      if (event.key.length === 1) {
        setValue(event.key)
      }
      setEditing(true)
    },
    [editing, isEditable, setEditing],
  )

  const ValueComponent = editing ? Input : Preview

  const isKeyCell = column.id === ColumnIds.Key
  const isValueCell = column.id === ColumnIds.Value
  const keyMenuOpened = menuOpened && isKeyCell
  const valueMenuOpened = menuOpened && isValueCell

  const menuForKey = React.useMemo(
    () =>
      getMenuForKey({
        required: row.original ? row.original.required : false,
        value: key,
      }),
    [row, key],
  )

  const menuForValue = React.useMemo(
    () =>
      getMenuForValue({
        valueSchema: row.original ? row.original.valueSchema : undefined,
      }),
    [row],
  )

  const hasMenu = React.useMemo(
    () =>
      Boolean((menuForKey.length && isKeyCell) || (menuForValue.length && isValueCell)),
    [isKeyCell, isValueCell, menuForKey, menuForValue],
  )

  return (
    <div
      className={classes.root}
      role="textbox"
      tabIndex={0}
      onDoubleClick={onDoubleClick}
      onKeyPress={onKeyPress}
    >
      <ValueComponent
        {...{
          columnId: column.id,
          data: row.original || {},
          hasMenu,
          menuAnchorRef,
          placeholder: {
            [ColumnIds.Key]: 'Key',
            [ColumnIds.Value]: 'Value',
          }[column.id],
          onChange,
          onExpand: () => onExpand(fieldPath),
          onMenu: onMenuOpen,
          title: isEditable ? 'Click to edit' : '',
          value,
        }}
      />

      {keyMenuOpened && menuForKey.length ? (
        <CellMenu
          anchorRef={menuAnchorRef}
          menu={menuForKey}
          onClick={onMenuSelect}
          onClose={closeMenu}
        />
      ) : null}

      {valueMenuOpened && menuForValue.length ? (
        <CellMenu
          anchorRef={menuAnchorRef}
          menu={menuForValue}
          onClick={onMenuSelect}
          onClose={closeMenu}
        />
      ) : null}
    </div>
  )
}
