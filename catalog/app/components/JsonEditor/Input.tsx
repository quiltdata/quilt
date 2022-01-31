import * as R from 'ramda'
import * as React from 'react'
import * as M from '@material-ui/core'

import { JsonSchema } from 'utils/json-schema'

import { JsonValue, COLUMN_IDS, EMPTY_VALUE, RowData } from './constants'
import { parseJSON, stringifyJSON } from './utils'

const useStyles = M.makeStyles((t) => ({
  root: {
    ...t.typography.body2,
    outline: `2px solid ${t.palette.primary.light}`,
    padding: t.spacing(0, 1),
    position: 'relative',
    width: '100%',
    zIndex: 1,
  },
}))

function getNormalizedValue(value: JsonValue, optSchema?: JsonSchema): JsonValue {
  // TODO: use json-schema#getEmptyValueFromSchema
  if (!optSchema && value === '') return EMPTY_VALUE // FIXME: think more on this

  if (value !== EMPTY_VALUE) return value

  if (!optSchema) return ''

  if (optSchema.enum && optSchema.enum.length) return optSchema.enum[0]

  if (optSchema.type) {
    switch (optSchema.type) {
      case 'string':
        return ''
      case 'number':
        return 0
      case 'object':
        return {}
      case 'null':
        return null
      case 'boolean':
        return true
      case 'array':
        return []
      // no default
    }
  }

  return ''
}

function getNormalizedValueStr(value: JsonValue, optSchema?: JsonSchema) {
  const normalizedValue = getNormalizedValue(value, optSchema)

  // FIXME: think more on this
  if (optSchema && (optSchema.type === 'null' || optSchema.type === 'boolean'))
    return normalizedValue

  if (normalizedValue === EMPTY_VALUE) return ''

  if (normalizedValue === '"') return '"'

  return stringifyJSON(normalizedValue)
}

function hasBrackets(valueStr: string) {
  if (valueStr.length < 2) return false
  return [
    ['"', '"'],
    ['[', ']'],
    ['{', '}'],
  ].some(([leftBracket, rightBracket]) =>
    R.both(R.startsWith(leftBracket), R.endsWith(rightBracket))(valueStr),
  )
}

const willBeNullInJson = (value: JsonValue) =>
  typeof value === 'number' && !Number.isFinite(value)

interface OnChange {
  (value: JsonValue): void
  (value: string): void
}

interface InputProps {
  columnId: 'key' | 'value'
  data: RowData
  onChange: OnChange
  onContextMenu: React.MouseEventHandler<HTMLElement>
  placeholder: string
  value: JsonValue
}

export default function Input({
  columnId,
  data,
  onChange,
  onContextMenu,
  placeholder,
  value: originalValue,
}: InputProps) {
  const classes = useStyles()

  const [value, setValue] = React.useState(() =>
    getNormalizedValue(originalValue, data.valueSchema),
  )
  const [valueStr, setValueStr] = React.useState(() =>
    getNormalizedValueStr(originalValue, data.valueSchema),
  )

  const inputRef = React.useRef<HTMLInputElement | null>(null)
  React.useEffect(() => {
    if (!inputRef.current || !valueStr) return
    if (hasBrackets(valueStr)) {
      // Set cursor before closing bracket/quote/brace
      inputRef.current.setSelectionRange(valueStr.length - 1, valueStr.length - 1)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onChangeInternal = React.useCallback(
    (event) => {
      setValue(parseJSON(event.target.value))
      setValueStr(event.target.value)
    },
    [setValue, setValueStr],
  )

  const onBlur = React.useCallback(() => {
    if (R.is(String, value)) return onChange(value)
    if (columnId === COLUMN_IDS.KEY) return onChange(valueStr)
    if (willBeNullInJson(value)) return onChange(null)
    return onChange(value)
  }, [onChange, columnId, value, valueStr])

  const onKeyDown = React.useCallback(
    (event) => {
      switch (event.key) {
        case 'Escape':
          event.stopPropagation() // avoid closing the dialog
          break
        case 'Enter':
          event.preventDefault() // avoid submitting the form
          onBlur()
          break
        // no default
      }
    },
    [onBlur],
  )

  const handleContextMenu = (event: React.MouseEvent<HTMLElement>) => {
    event.preventDefault()
    onContextMenu(event)
  }

  return (
    <M.InputBase
      autoFocus
      inputRef={inputRef}
      className={classes.root}
      value={valueStr}
      onChange={onChangeInternal}
      onContextMenu={handleContextMenu}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
    />
  )
}
