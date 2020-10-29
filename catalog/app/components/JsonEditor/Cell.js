import * as React from 'react'

import * as M from '@material-ui/core'

import { isSchemaEnum } from 'utils/json-schema'

import Input from './Input'
import Preview from './Preview'
import { Actions, ColumnIds } from './State'

function CellMenu({ anchorRef, menu, onClose, onClick }) {
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

function MenuForKey({ anchorRef, keysList, onMenuSelect, onClose }) {
  const keysOptions = keysList.map((title) => ({
    action: Actions.Select,
    title,
  }))
  const actionsOptions = [
    {
      action: Actions.RemoveField,
      title: 'Remove',
    },
  ]
  const keysSubmenu = {
    header: 'Keys',
    key: 'keys',
    options: keysOptions,
  }
  const actionsSubmenu = {
    key: 'actions',
    options: actionsOptions,
  }
  const menu = keysOptions.length ? [keysSubmenu] : [actionsSubmenu]
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

export default function Cell({
  column,
  columnPath,
  onExpand,
  editing: editingInitial,
  onMenuAction,
  row,
  updateMyData,
  value,
}) {
  const menuAnchorRef = React.useRef(null)

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
      updateMyData(fieldPath, column.id, newValue)
      setEditing(false)
    },
    [column.id, fieldPath, updateMyData],
  )

  const onDoubleClick = React.useCallback(() => setEditing(true), [setEditing])
  const onKeyPress = React.useCallback(
    (event) => {
      if (event.key !== 'Enter') return
      setEditing(true)
    },
    [setEditing],
  )

  const ValueComponent = editing ? Input : Preview

  const hasKeyMenu = menuOpened && column.id === ColumnIds.Key
  const hasValueMenu = menuOpened && column.id === ColumnIds.Value

  return (
    <div
      onDoubleClick={onDoubleClick}
      onKeyPress={onKeyPress}
      tabIndex={0}
      role="textbox"
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
          keysList={row.original && key === '' ? row.original.keysList : []}
          onMenuSelect={onMenuSelect}
          onClose={closeMenu}
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
