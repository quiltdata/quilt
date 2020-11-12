import * as R from 'ramda'
import * as React from 'react'
import * as M from '@material-ui/core'

import ButtonMenu from './ButtonMenu'
import Note from './Note'
import { COLUMN_IDS, EMPTY_VALUE, parseJSON, stringifyJSON } from './State'

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

function getNormalizedValue(value, optSchema) {
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

function getNormalizedValueStr(value, optSchema) {
  const normalizedValue = getNormalizedValue(value, optSchema)

  // FIXME: think more on this
  if (optSchema && (optSchema.type === 'null' || optSchema.type === 'boolean'))
    return normalizedValue

  if (normalizedValue === EMPTY_VALUE) return ''

  if (normalizedValue === '"') return '"'

  return stringifyJSON(normalizedValue)
}

function hasBrackets(valueStr) {
  if (valueStr.length < 2) return false
  return [
    ['"', '"'],
    ['[', ']'],
    ['{', '}'],
  ].some(([leftBracket, rightBracket]) =>
    R.both(R.startsWith(leftBracket), R.endsWith(rightBracket))(valueStr),
  )
}

export default function Input({
  columnId,
  data,
  menu,
  menuOpened,
  onChange,
  onMenu,
  onMenuClose,
  onMenuSelect,
  placeholder,
  value: originalValue,
}) {
  const classes = useStyles()

  const [value, setValue] = React.useState(() =>
    getNormalizedValue(originalValue, data.valueSchema),
  )
  const [valueStr, setValueStr] = React.useState(() =>
    getNormalizedValueStr(originalValue, data.valueSchema),
  )

  const inputRef = React.useRef()
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
    if (columnId !== COLUMN_IDS.KEY || R.is(String, value)) {
      onChange(value)
    } else {
      onChange(JSON.stringify(value))
    }
  }, [onChange, columnId, value])

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

  return (
    <M.InputBase
      autoFocus
      inputRef={inputRef}
      endAdornment={
        <ButtonMenu
          menu={menu}
          menuOpened={menuOpened}
          note={<Note {...{ columnId, data, value }} />}
          onClick={onMenu}
          onMenuClose={onMenuClose}
          onMenuSelect={onMenuSelect}
        />
      }
      className={classes.root}
      value={valueStr}
      onChange={onChangeInternal}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
    />
  )
}
