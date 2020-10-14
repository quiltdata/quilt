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
  menu,
  onExpand,
  onMenuOpen,
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

  const onMenu = React.useCallback(() => {
    setMenuOpened(true)
    onMenuOpen(fieldPath, column.id)
  }, [column, fieldPath, onMenuOpen, setMenuOpened])

  const onChange = React.useCallback(
    (newValue) => {
      updateMyData(fieldPath, column.id, newValue)
      setEditing(false)
    },
    [column.id, fieldPath, updateMyData],
  )

  const onDoubleClick = React.useCallback(() => setEditing(true), [setEditing])

  const ValueComponent = editing ? Input : Preview

  return (
    <div onDoubleClick={onDoubleClick}>
      <div ref={menuAnchorRef}>
        <ValueComponent
          {...{
            columnId: column.id,
            onChange,
            onExpand: () => onExpand(fieldPath),
            onMenu,
            data: row.original || {},
            value,
          }}
        />
      </div>

      {menuOpened && (
        <CellMenu
          anchorRef={menuAnchorRef}
          menu={menu}
          onClick={(menuKey) => onMenuSelect(fieldPath, menuKey)}
          onClose={closeMenu}
        />
      )}
    </div>
  )
}
