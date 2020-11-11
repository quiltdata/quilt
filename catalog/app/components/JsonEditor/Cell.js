import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import { isSchemaEnum } from 'utils/json-schema'

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

function getMenuForKey({ required, value }) {
  if (required || value === EMPTY_VALUE) {
    return emptyMenu
  }
  return [actionsSubmenu]
}

function getMenuForValue({ valueSchema }) {
  if (!isSchemaEnum(valueSchema)) {
    return emptyMenu
  }

  const enumOptions = valueSchema.enum.map((title) => ({
    action: ACTIONS.SELECT_ENUM,
    title,
  }))
  const enumSubmenu = {
    header: 'Enum',
    key: 'enum',
    options: enumOptions,
  }
  return [enumSubmenu]
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

  const isEditable = React.useMemo(
    () => !(column.id === COLUMN_IDS.KEY && row.original && row.original.valueSchema),
    [column.id, row.original],
  )

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

  const ValueComponent = editing ? Input : Preview

  const isKeyCell = column.id === COLUMN_IDS.KEY
  const isValueCell = column.id === COLUMN_IDS.VALUE
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

  return (
    <div
      className={cx(classes.root, { [classes.disabled]: !isEditable })}
      role="textbox"
      tabIndex={0}
      onDoubleClick={onDoubleClick}
      onKeyPress={onKeyPress}
    >
      <ValueComponent
        {...{
          columnId: column.id,
          data: row.original || emptyCellData,
          menu: isKeyCell ? menuForKey : menuForValue,
          menuOpened: keyMenuOpened || valueMenuOpened,
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
