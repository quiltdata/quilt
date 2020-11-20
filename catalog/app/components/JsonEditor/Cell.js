import cx from 'classnames'
import * as React from 'react'
import * as R from 'ramda'
import * as M from '@material-ui/core'

import { isSchemaEnum } from 'utils/json-schema'

import EnumSelect from './EnumSelect'
import Input from './Input'
import Preview from './Preview'
import { ACTIONS, COLUMN_IDS, EMPTY_VALUE, parseJSON } from './State'

const emptyMenu = []

const actionsSubmenu = {
  key: 'actions',
  options: [
    {
      action: ACTIONS.REMOVE_FIELD,
      title: 'Remove',
    },
  ],
}

function getMenu({ required, value }) {
  if (required || value === EMPTY_VALUE) {
    return emptyMenu
  }
  return [actionsSubmenu]
}

const useStyles = M.makeStyles((t) => ({
  root: {
    '&:focus': {
      outline: `1px solid ${t.palette.primary.light}`,
    },
  },
  disabled: {
    cursor: 'not-allowed',
  },
}))

const emptyCellData = {}

const cellPlaceholders = {
  [COLUMN_IDS.KEY]: 'Key',
  [COLUMN_IDS.VALUE]: 'Value',
}

export default function Cell({
  column,
  columnPath,
  editing: editingInitial,
  onExpand,
  onMenuAction,
  row,
  updateMyData,
  value: initialValue,
}) {
  const classes = useStyles()

  const [value, setValue] = React.useState(initialValue)

  const [editing, setEditing] = React.useState(editingInitial)
  const [menuOpened, setMenuOpened] = React.useState(false)

  const key = row.values[COLUMN_IDS.KEY]
  const fieldPath = React.useMemo(() => columnPath.concat(key), [columnPath, key])

  const closeMenu = React.useCallback(() => setMenuOpened(false), [setMenuOpened])

  const onMenuOpen = React.useCallback(() => setMenuOpened(true), [setMenuOpened])

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

  const isKeyCell = column.id === COLUMN_IDS.KEY
  const isValueCell = column.id === COLUMN_IDS.VALUE

  const isEditable = React.useMemo(
    () => !(isKeyCell && row.original && row.original.valueSchema),
    [isKeyCell, row.original],
  )

  const isEnumCell = React.useMemo(
    () => isValueCell && isSchemaEnum(R.path(['original', 'valueSchema'], row)),
    [isValueCell, row],
  )

  const onDoubleClick = React.useCallback(() => {
    if (!isEditable) return
    setEditing(true)
  }, [isEditable, setEditing])

  const onKeyPress = React.useCallback(
    (event) => {
      if (!editing) {
        // Chromium able to send key event to Input created after this key event.
        // Avoid to send this key event to Input constistently with Firefox
        event.preventDefault()
      }

      // Do nothing, if it's a key cell provided by schema
      if (!isEditable) return

      // When user start typing he enters first symbol.
      // Preview is replaced by Input, this first symbol sets to Input and resets previous text
      // If user hit Enter Preview is replaced by Input, and Input contains previous text
      if (event.key.length !== 1 && event.key !== 'Enter') return

      if (event.key.length === 1) {
        switch (event.key) {
          case '"':
            setValue('"')
            break
          case '[':
            setValue([])
            break
          case '{':
            setValue({})
            break
          default:
            setValue(parseJSON(event.key))
            break
        }
      }
      setEditing(true)
    },
    [editing, isEditable, setEditing],
  )

  const menu = React.useMemo(
    () =>
      isKeyCell
        ? getMenu({
            required: row.original ? row.original.required : false,
            value: key,
          })
        : emptyMenu,
    [isKeyCell, key, row],
  )

  const ValueComponent = React.useMemo(() => {
    if (isEnumCell) return EnumSelect
    if (editing) return Input
    return Preview
  }, [editing, isEnumCell])

  return (
    <div
      className={cx(classes.root, { [classes.disabled]: !isEditable })}
      role="textbox"
      tabIndex={isEditable ? 0 : null}
      onDoubleClick={onDoubleClick}
      onKeyPress={onKeyPress}
    >
      <ValueComponent
        {...{
          columnId: column.id,
          data: row.original || emptyCellData,
          menu,
          menuOpened,
          onChange,
          onExpand: React.useCallback(() => onExpand(fieldPath), [fieldPath, onExpand]),
          onMenu: onMenuOpen,
          onMenuClose: closeMenu,
          onMenuSelect,
          placeholder: cellPlaceholders[column.id],
          title: isEditable ? 'Click to edit' : '',
          value,
        }}
      />
    </div>
  )
}
