import * as React from 'react'
import cx from 'classnames'
import isObject from 'lodash/isObject'

import * as M from '@material-ui/core'

import { ColumnIds, parseJSON } from 'utils/json'

import ButtonExpand from './ButtonExpand'
import ButtonMenu from './ButtonMenu'

const i18nMsgs = {
  key: 'Key',
  value: 'Value',
}

const useStyles = M.makeStyles((t) => ({
  root: {
    padding: t.spacing(1),
    width: '100%',
  },

  expand: {
    cursor: 'pointer',
    margin: `0 ${t.spacing(1)}px 0 0`,
  },

  menu: {
    cursor: 'pointer',
    color: t.palette.divider,
  },

  rootKey: {
    borderRight: `1px solid ${t.palette.divider}`,
  },
}))

export default function Input({
  columnId,
  fieldPath,
  onChange,
  onExpand,
  onMenu,
  value: initialValue,
}) {
  const classes = useStyles()

  const [value, setValue] = React.useState(initialValue)

  const onChangeInternal = React.useCallback(
    (event) => {
      setValue(event.target.value)
    },
    [setValue],
  )

  const onBlur = React.useCallback(() => {
    setValue(parseJSON(value))
    onChange(value)
  }, [onChange, setValue, value])

  const onFocus = React.useCallback(() => {
    if (isObject(value)) {
      setValue(JSON.stringify(value))
    }
  }, [setValue, value])

  return (
    <M.InputBase
      autoFocus
      startAdornment={
        isObject(value) && <ButtonExpand onClick={() => onExpand(fieldPath)} />
      }
      endAdornment={<ButtonMenu onClick={onMenu} />}
      className={cx(classes.root, {
        [classes.rootKey]: columnId === ColumnIds.Key,
        [classes.rootValue]: columnId === ColumnIds.Value,
      })}
      value={value}
      onChange={onChangeInternal}
      onBlur={onBlur}
      onFocus={onFocus}
      placeholder={
        {
          [ColumnIds.Key]: i18nMsgs.key,
          [ColumnIds.Value]: i18nMsgs.value,
        }[columnId]
      }
    />
  )
}
