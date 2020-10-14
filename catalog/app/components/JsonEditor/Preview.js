import * as R from 'ramda'
import * as React from 'react'
import isArray from 'lodash/isArray'
import isObject from 'lodash/isObject'
import isString from 'lodash/isString'
import isNumber from 'lodash/isNumber'

import * as M from '@material-ui/core'

import { ColumnIds } from 'utils/json'

import ButtonExpand from './ButtonExpand'
import ButtonMenu from './ButtonMenu'

const useStyles = M.makeStyles((t) => ({
  root: {
    alignItems: 'center',
    borderRight: `1px solid ${t.palette.divider}`,
    display: 'flex',
    height: t.spacing(6),
    padding: t.spacing(1),
    width: '100%',
  },

  value: {
    flexGrow: 1,
    fontSize: '1rem',
    marginRight: t.spacing(1),
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: t.spacing(26),
  },

  menu: {
    marginLeft: 'auto',
  },
}))

function formatValuePreview(x) {
  if (isArray(x)) {
    return `[ ${x.map(formatValuePreview)} ]`
  }

  if (isObject(x)) {
    return `{ ${Object.keys(x).join(', ')} }`
  }

  return x
}

function NoteKey() {
  const required = true
  return required ? '*' : ''
}

function NoteValue({ value }) {
  return R.cond([
    [isArray, () => 'arr'],
    [isObject, () => 'obj'],
    [isString, () => 'str'],
    [isNumber, () => 'num'],
    [isNumber, () => 'num'],
    [R.T, () => 'nothing'],
  ])(value)
}

function Note({ columnId, value }) {
  if (columnId === ColumnIds.Key) {
    return <NoteKey value={value} />
  }

  if (columnId === ColumnIds.Value) {
    return <NoteValue value={value} />
  }

  throw new Error('Wrong columnId')
}

export default function Preview({ columnId, value, onExpand, onMenu }) {
  const classes = useStyles()

  return (
    <div className={classes.root}>
      {isObject(value) && <ButtonExpand onClick={onExpand} />}

      <div className={classes.value}>
        <span className={classes.valueInner}>{formatValuePreview(value)}</span>
      </div>

      <ButtonMenu
        className={classes.menu}
        note={<Note {...{ columnId, value }} />}
        onClick={onMenu}
      />
    </div>
  )
}
