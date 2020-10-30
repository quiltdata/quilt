import * as React from 'react'
import * as R from 'ramda'
import cx from 'classnames'
import isNumber from 'lodash/isNumber'
import isObject from 'lodash/isObject'
import isString from 'lodash/isString'

import * as M from '@material-ui/core'

import ButtonExpand from './ButtonExpand'
import ButtonMenu from './ButtonMenu'
import Note from './Note'
import { ColumnIds, EmptyValue, parseJSON } from './State'

const i18nMsgs = {
  key: 'Key',
  value: 'Value',
}

const useStyles = M.makeStyles((t) => ({
  root: {
    padding: t.spacing(1),
    position: 'relative',
    width: '100%',
  },

  rootKey: {
    borderRight: `1px solid ${t.palette.divider}`,
  },
}))

function getNormalizedValue(value, schema) {
  // TODO: use json-schema#getEmptyValueFromSchema
  if (value !== EmptyValue) return value

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
      case 'array':
        return []
      // no default
    }
  }

  return ''
}

function getNormalizedValueStr(value) {
  const valueStr = JSON.stringify(value, null, 2)
  if (R.head(valueStr) === '"' && R.last(valueStr) === '"') {
    return valueStr.substring(1, valueStr.length - 1)
  }

  return valueStr
}

export default function Input({
  columnId,
  data,
  fieldPath,
  onChange,
  onExpand,
  onMenu,
  value: originalValue,
}) {
  const classes = useStyles()

  const inputRef = React.useRef()
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
    onChange(value)
  }, [onChange, value])

  const onFocus = React.useCallback(() => {
    // HACK: inputRef.current is empty before timeout
    // TODO: use useEffect and leverage autofocus
    setTimeout(() => {
      if (!inputRef.current) return

      if (!isString(value) && !isNumber(value)) return

      inputRef.current.setSelectionRange(0, valueStr.length)
    }, 100)
  }, [inputRef, value, valueStr])

  const onKeyDown = React.useCallback(
    (event) => {
      switch (event.key) {
        case 'Enter':
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
      startAdornment={
        isObject(originalValue) && <ButtonExpand onClick={() => onExpand(fieldPath)} />
      }
      endAdornment={
        <ButtonMenu note={<Note {...{ columnId, data, value }} />} onClick={onMenu} />
      }
      className={cx(classes.root, {
        [classes.rootKey]: columnId === ColumnIds.Key,
        [classes.rootValue]: columnId === ColumnIds.Value,
      })}
      value={valueStr}
      onChange={onChangeInternal}
      onBlur={onBlur}
      onFocus={onFocus}
      onKeyDown={onKeyDown}
      placeholder={
        {
          [ColumnIds.Key]: i18nMsgs.key,
          [ColumnIds.Value]: i18nMsgs.value,
        }[columnId]
      }
    />
  )
}
