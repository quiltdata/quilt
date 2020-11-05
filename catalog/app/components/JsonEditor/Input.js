import isObject from 'lodash/isObject'
import isString from 'lodash/isString'
import * as R from 'ramda'
import * as React from 'react'
import * as M from '@material-ui/core'

import ButtonExpand from './ButtonExpand'
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

function getNormalizedValue(value, schema) {
  // TODO: use json-schema#getEmptyValueFromSchema
  if (value !== EMPTY_VALUE) return value

  if (!schema) return ''

  if (schema.enum && schema.enum.length) return schema.enum[0]

  if (schema.type) {
    switch (schema.type) {
      case 'string':
        return ''
      case 'number':
        return 0
      case 'object':
        return {}
      case 'null':
        return null
      case 'array':
        return []
      // no default
    }
  }

  return ''
}

function getNormalizedValueStr(value) {
  const valueStr = stringifyJSON(value)
  if (R.head(valueStr) === '"' && R.last(valueStr) === '"') {
    return valueStr.substring(1, valueStr.length - 1)
  }

  return valueStr
}

export default function Input({
  columnId,
  data,
  fieldPath,
  hasMenu,
  placeholder,
  onChange,
  onExpand,
  onMenu,
  value: originalValue,
}) {
  const classes = useStyles()

  const normalizedValue = getNormalizedValue(originalValue, data.valueSchema)
  const [value, setValue] = React.useState(normalizedValue)
  const [valueStr, setValueStr] = React.useState(getNormalizedValueStr(normalizedValue))

  const onChangeInternal = React.useCallback(
    (event) => {
      setValue(parseJSON(event.target.value))
      setValueStr(event.target.value)
    },
    [setValue, setValueStr],
  )

  const onBlur = React.useCallback(() => {
    if (columnId !== COLUMN_IDS.KEY || isString(value)) {
      onChange(value)
    } else {
      onChange(JSON.stringify(value))
    }
  }, [onChange, columnId, value])

  const onButtonExpandClick = React.useCallback(() => onExpand(fieldPath), [
    fieldPath,
    onExpand,
  ])

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
      startAdornment={
        isObject(originalValue) && <ButtonExpand onClick={onButtonExpandClick} />
      }
      endAdornment={
        <ButtonMenu
          hasMenu={hasMenu}
          note={<Note {...{ columnId, data, value }} />}
          onClick={onMenu}
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
