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

function MenuForKey({ anchorRef, required, value, onMenuSelect, onClose }) {
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
  const menu = required || value === EmptyValue ? [] : [actionsSubmenu]
  return (
    <CellMenu
      {...{
        anchorRef,
        menu,
        onClick: onMenuSelect,
        onClose,
      }}
    />
  )
}

function MenuForValue({ anchorRef, valueSchema, onMenuSelect, onClose }) {
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
  const menu = [enumSubmenu]
  return (
    <CellMenu
      {...{
        anchorRef,
        menu,
        onClick: onMenuSelect,
        onClose,
      }}
    />
  )
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

  const hasKeyMenu = menuOpened && column.id === ColumnIds.Key
  const hasValueMenu = menuOpened && column.id === ColumnIds.Value

  return (
    <div
      className={classes.root}
      role="textbox"
      tabIndex={0}
      title={isEditable ? 'Click to edit' : ''}
      onDoubleClick={onDoubleClick}
      onKeyPress={onKeyPress}
    >
      <ValueComponent
        {...{
          menuAnchorRef,
          columnId: column.id,
          onChange,
          onExpand: () => onExpand(fieldPath),
          onMenu: onMenuOpen,
          data: row.original || {},
          value,
        }}
      />

      {hasKeyMenu && (
        <MenuForKey
          anchorRef={menuAnchorRef}
          onClose={closeMenu}
          onMenuSelect={onMenuSelect}
          required={row.original ? row.original.required : false}
          value={value}
        />
      )}

      {hasValueMenu && (
        <MenuForValue
          anchorRef={menuAnchorRef}
          valueSchema={row.original ? row.original.valueSchema : undefined}
          onMenuSelect={onMenuSelect}
          onClose={closeMenu}
        />
      )}
    </div>
  )
}
