import * as React from 'react'
import cx from 'classnames'
import isObject from 'lodash/isObject'

import * as M from '@material-ui/core'

import ButtonExpand from './ButtonExpand'
import ButtonMenu from './ButtonMenu'
import Note from './Note'
import { ColumnIds, parseJSON } from './State'

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

  const [value, setValue] = React.useState(originalValue)
  const [valueStr, setValueStr] = React.useState(JSON.stringify(originalValue))

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

  return (
    <M.InputBase
      autoFocus
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
      placeholder={
        {
          [ColumnIds.Key]: i18nMsgs.key,
          [ColumnIds.Value]: i18nMsgs.value,
        }[columnId]
      }
    />
  )
}
