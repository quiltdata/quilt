import * as R from 'ramda'
import * as React from 'react'
import cx from 'classnames'
import isArray from 'lodash/isArray'
import isNumber from 'lodash/isNumber'
import isObject from 'lodash/isObject'
import isString from 'lodash/isString'
import isUndefined from 'lodash/isUndefined'

import * as M from '@material-ui/core'

import { ColumnIds } from './State'

const useStyles = M.makeStyles((t) => ({
  default: {
    color: t.palette.text.secondary,
  },

  mismatch: {
    color: t.palette.error.main,
  },
}))

function getTypeAnnotation(value, originalType) {
  return R.cond([
    [isArray, () => 'arr'],
    [isObject, () => 'obj'],
    [
      isString,
      () => {
        if (isArray(originalType) && originalType.includes(value)) {
          return 'enum'
        }
        return 'str'
      },
    ], // TODO: check for enum
    [isNumber, () => 'num'],
    [R.T, () => 'nothing'],
  ])(value)
}

function doesTypeMatch(value, originalType) {
  // NOTE: `typeof value === originalType`
  //       forbidden by eslint rules
  return R.cond([
    [isArray, () => originalType === 'array'],
    [isObject, () => originalType === 'object'],
    [
      isString,
      () => {
        if (originalType === 'string') return true

        return isArray(originalType) && originalType.includes(value)
      },
    ],
    [isNumber, () => originalType === 'number'],
    [R.T, isUndefined],
  ])(value)
}

function NoteValue({ originalType, value }) {
  const classes = useStyles()

  const mismatch = !doesTypeMatch(value, originalType)
  const typeHelp = originalType
    ? `Value should be of ${originalType} type`
    : 'Key/value is not restricted by schema'

  return (
    <M.Tooltip title={typeHelp}>
      <span
        className={cx(classes.default, {
          [classes.mismatch]: mismatch,
        })}
      >
        {getTypeAnnotation(value, originalType)}
      </span>
    </M.Tooltip>
  )
}

export default function Note({ columnId, data, value }) {
  if (columnId === ColumnIds.Value) {
    return <NoteValue value={value} originalType={data.valueType} />
  }

  return null
}
