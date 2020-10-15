import * as React from 'react'

import isString from 'lodash/isString'

import * as M from '@material-ui/core'

import Input from './Input'
import Preview from './Preview'
import { Actions, ColumnIds } from './State'

function CellMenu({ anchorRef, menu, onClose, onClick }) {
  return (
    <M.Menu anchorEl={anchorRef.current} onClose={onClose} open>
      {menu.map((item) =>
        isString(item) ? (
          <M.MenuItem key={item} onClick={() => onClick(item)}>
            {item}
          </M.MenuItem>
        ) : (
          <M.MenuItem key={item.title} onClick={() => onClick(item)}>
            {item.title}
          </M.MenuItem>
        ),
      )}
    </M.Menu>
  )
}

export default function KeyCell({
  column,
  columnPath,
  onExpand,
  onMenuSelect,
  onMenuAction,
  row,
  updateMyData,
  value,
}) {
  const menuAnchorRef = React.useRef(null)

  const [editing, setEditing] = React.useState(false)
  const [menuOpened, setMenuOpened] = React.useState(false)

  const key = row.values[ColumnIds.Key]
  const fieldPath = React.useMemo(() => columnPath.concat(key), [columnPath, key])

  const closeMenu = React.useCallback(() => setMenuOpened(false), [setMenuOpened])

  const onMenuOpenInternal = React.useCallback(() => {
    setMenuOpened(true)
  }, [setMenuOpened])

  const onMenuSelectInternal = React.useCallback(
    (menuItem) => {
      setMenuOpened(false)

      if (isString(menuItem)) {
        // TODO: should be "select" action
        onMenuSelect(fieldPath, menuItem)
      } else {
        onMenuAction(fieldPath, menuItem)
      }
    },
    [fieldPath, onMenuAction, onMenuSelect, setMenuOpened],
  )

  const onChange = React.useCallback(
    (newValue) => {
      updateMyData(fieldPath, column.id, newValue)
      setEditing(false)
    },
    [column.id, fieldPath, updateMyData],
  )

  const onDoubleClick = React.useCallback(() => setEditing(true), [setEditing])

  const ValueComponent = editing ? Input : Preview

  const hasKeyMenu = menuOpened && column.id === ColumnIds.Key
  const hasValueMenu = menuOpened && column.id === ColumnIds.Value

  const keyMenu = (row.original && key === '' ? row.original.keysList : []).concat({
    action: Actions.RemoveField,
    title: 'Remove',
  })

  return (
    <div onDoubleClick={onDoubleClick}>
      <ValueComponent
        {...{
          menuAnchorRef,
          columnId: column.id,
          onChange,
          onExpand: () => onExpand(fieldPath),
          onMenu: onMenuOpenInternal,
          data: row.original || {},
          value,
        }}
      />

      {hasKeyMenu && (
        <CellMenu
          anchorRef={menuAnchorRef}
          menu={keyMenu}
          onClick={onMenuSelectInternal}
          onClose={closeMenu}
        />
      )}

      {hasValueMenu && (
        <CellMenu
          anchorRef={menuAnchorRef}
          menu={['string']}
          onClick={onMenuSelectInternal}
          onClose={closeMenu}
        />
      )}
    </div>
  )
}
