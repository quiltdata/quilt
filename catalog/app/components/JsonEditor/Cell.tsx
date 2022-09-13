import cx from 'classnames'
import * as R from 'ramda'
import * as React from 'react'
import * as RTable from 'react-table'
import * as M from '@material-ui/core'

import { isSchemaEnum } from 'utils/json-schema'

import ContextMenu from './ContextMenu'
import EnumSelect from './EnumSelect'
import Input from './Input'
import Preview from './Preview'
import { COLUMN_IDS, JsonValue, RowData, EMPTY_VALUE } from './constants'
import { parseJSON } from './utils'

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

const cellPlaceholders = {
  [COLUMN_IDS.KEY]: 'Key',
  [COLUMN_IDS.VALUE]: 'Value',
}

interface CellProps {
  column: RTable.Column<{ id: 'key' | 'value' }>
  columnPath: string[]
  contextMenuPath: string[]
  editing: boolean
  onContextMenu: (path: string[]) => void
  onExpand: (path: string[]) => void
  onRemove: (path: string[]) => void
  row: Pick<RTable.Row<RowData>, 'original' | 'values'>
  updateMyData: (path: string[], id: 'key' | 'value', value: JsonValue) => void
  value: JsonValue
}

export default function Cell({
  column,
  columnPath,
  contextMenuPath,
  editing: editingInitial,
  onContextMenu,
  onExpand,
  onRemove,
  row,
  updateMyData,
  value: initialValue,
}: CellProps) {
  const classes = useStyles()

  const [value, setValue] = React.useState(initialValue)

  const [editing, setEditing] = React.useState(editingInitial)

  const key = row.values[COLUMN_IDS.KEY]
  const fieldPath = React.useMemo(() => columnPath.concat(key), [columnPath, key])
  const hasKey = React.useMemo(() => key !== EMPTY_VALUE, [key])

  const onChange = React.useCallback(
    (newValue) => {
      setValue(newValue)
      updateMyData(fieldPath, column.id as 'key' | 'value', newValue)
      setEditing(false)
    },
    [column.id, fieldPath, updateMyData],
  )

  const isKeyCell = column.id === COLUMN_IDS.KEY
  const isValueCell = column.id === COLUMN_IDS.VALUE

  const isEditable = React.useMemo(
    () => !(isKeyCell && row.original.valueSchema),
    [isKeyCell, row.original],
  )

  const isEnumCell = React.useMemo(
    () => isValueCell && isSchemaEnum(row.original.valueSchema),
    [isValueCell, row],
  )

  const onDoubleClick = React.useCallback(() => {
    if (!isEditable) return
    setEditing(true)
  }, [isEditable, setEditing])

  const onKeyPress = React.useCallback(
    (event) => {
      if (editing) return

      // Chromium able to send key event to Input created after this key event.
      // Avoid to send this key event to Input constistently with Firefox
      event.preventDefault()

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

  const ValueComponent = React.useMemo(() => {
    if (editing && isEnumCell) return EnumSelect
    if (editing) return Input
    return Preview
  }, [editing, isEnumCell])

  const addressPath = React.useMemo(() => [...columnPath, key], [columnPath, key])
  const [anchorEl, setAnchorEl] = React.useState<HTMLDivElement | null>(null)
  const handleContextMenu = React.useCallback(
    (event) => {
      event.preventDefault()
      onContextMenu(addressPath)
    },
    [onContextMenu, addressPath],
  )

  return (
    <div
      className={cx(classes.root, { [classes.disabled]: !isEditable })}
      onDoubleClick={onDoubleClick}
      onKeyPress={onKeyPress}
      ref={setAnchorEl}
      role="textbox"
      tabIndex={isEditable ? 0 : undefined}
    >
      <ValueComponent
        {...{
          columnId: column.id as 'key' | 'value',
          data: row.original,
          onChange,
          onContextMenu: handleContextMenu,
          onExpand: React.useCallback(() => onExpand(fieldPath), [fieldPath, onExpand]),
          onRemove: React.useCallback(() => onRemove(fieldPath), [fieldPath, onRemove]),
          placeholder: cellPlaceholders[column.id!],
          title: isEditable ? 'Click to edit' : '',
          value,
        }}
      />

      {anchorEl && isValueCell && hasKey && (
        <ContextMenu
          onChange={onChange}
          anchorEl={anchorEl}
          open={R.equals(contextMenuPath, addressPath)}
          onClose={() => onContextMenu([])}
          value={value}
        />
      )}
    </div>
  )
}
