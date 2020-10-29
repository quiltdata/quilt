import * as R from 'ramda'
import * as React from 'react'
import cx from 'classnames'
import isArray from 'lodash/isArray'
import isNumber from 'lodash/isNumber'
import isObject from 'lodash/isObject'
import isString from 'lodash/isString'
import isUndefined from 'lodash/isUndefined'

import * as M from '@material-ui/core'

import { ColumnIds, EmptyValue } from './State'

const useStyles = M.makeStyles((t) => ({
  default: {
    color: t.palette.text.secondary,
  },

  mismatch: {
    color: t.palette.error.main,
  },

  notInSchema: {
    color: t.palette.warning.dark,
  },
}))

function getTypeAnnotationFromValue(value, schema) {
  return R.cond([
    [isArray, () => 'arr'],
    [isObject, () => 'obj'],
    [
      isString,
      () => {
        if (R.propOr([], 'enum', schema).includes(value)) {
          return 'enum'
        }
        return 'str'
      },
    ],
    [isNumber, () => 'num'],
    [R.T, () => 'none'],
  ])(value)
}

function getTypeAnnotationFromSchema(schema) {
  if (!schema) return 'none'

  if (schema.enum) return 'enum' // NOTE: enum has `type` too

  if (schema.const) return 'const' // NOTE: cosnt has `type` too

  if (schema.type) return R.take(3, schema.type)

  const isCompoundType = ['anyOf', 'oneOf', 'not', 'allOf'].some((key) => schema[key])
  if (isCompoundType) return 'comp'

  if (schema.$ref) return '$ref'

  return 'none'
}

function getTypeAnnotation(value, schema) {
  if (value === EmptyValue) {
    return getTypeAnnotationFromSchema(schema)
  }

  return getTypeAnnotationFromValue(value, schema)
}

function doesTypeMatch(value, originalType) {
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

function NoteValue({ originalType, schema, value }) {
  const classes = useStyles()

  const mismatch = !doesTypeMatch(value, originalType)
  const typeNotInSchema = !originalType
  const typeHelp = typeNotInSchema
    ? 'Key/value is not restricted by schema or value has compound type'
    : `Value should be of ${originalType} type`

  return (
    <M.Tooltip title={typeHelp}>
      <span
        className={cx(classes.default, {
          [classes.mismatch]: mismatch,
          [classes.notInSchema]: typeNotInSchema,
        })}
      >
        {getTypeAnnotation(value, schema)}
      </span>
    </M.Tooltip>
  )
}

export default function Note({ columnId, data, value }) {
  if (columnId === ColumnIds.Value) {
    return (
      <NoteValue value={value} originalType={data.valueType} schema={data.valueSchema} />
    )
  }

  return null
}
