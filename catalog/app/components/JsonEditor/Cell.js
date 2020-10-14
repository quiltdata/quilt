import * as React from 'react'

import * as M from '@material-ui/core'

import Input from './Input'
import Preview from './Preview'
import { ColumnIds } from './State'

function CellMenu({ anchorRef, menu, onClose, onClick }) {
  return (
    <M.Menu anchorEl={anchorRef.current} onClose={onClose} open>
      {menu.map((key) => (
        <M.MenuItem key={key} onClick={() => onClick(key)}>
          {key}
        </M.MenuItem>
      ))}
    </M.Menu>
  )
}

export default function KeyCell({
  column,
  columnPath,
  onExpand,
  onMenuSelect,
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
    (menuKey) => {
      setMenuOpened(false)
      onMenuSelect(fieldPath, menuKey)
    },
    [fieldPath, onMenuSelect, setMenuOpened],
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

  return (
    <div onDoubleClick={onDoubleClick}>
      <div>
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
      </div>

      {hasKeyMenu && (
        <CellMenu
          anchorRef={menuAnchorRef}
          menu={row.original ? row.original.keysList : []}
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
