import * as R from 'ramda'
import * as React from 'react'
import isArray from 'lodash/isArray'
import isObject from 'lodash/isObject'
import isString from 'lodash/isString'
import isNumber from 'lodash/isNumber'

import * as M from '@material-ui/core'

import { ColumnIds } from './State'

const useStyles = M.makeStyles((t) => ({
  default: {
    color: t.palette.text.secondary,
  },

  required: {
    color: t.palette.error.main,
  },
}))

function NoteKey({ required }) {
  const classes = useStyles()

  return <span className={classes.required}>{required && '*'}</span>
}

function NoteValue({ value }) {
  const classes = useStyles()

  return (
    <span className={classes.default}>
      {R.cond([
        [isArray, () => 'arr'],
        [isObject, () => 'obj'],
        [isString, () => 'str'],
        [isNumber, () => 'num'],
        [isNumber, () => 'num'],
        [R.T, () => 'nothing'],
      ])(value)}
    </span>
  )
}

export default function Note({ columnId, required, value }) {
  if (columnId === ColumnIds.Key) {
    return <NoteKey required={required} value={value} />
  }

  if (columnId === ColumnIds.Value) {
    return <NoteValue value={value} />
  }

  throw new Error('Wrong columnId')
}
