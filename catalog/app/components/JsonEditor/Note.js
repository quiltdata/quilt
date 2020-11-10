import cx from 'classnames'
import isArray from 'lodash/isArray'
import isBoolean from 'lodash/isBoolean'
import isNull from 'lodash/isNull'
import isNumber from 'lodash/isNumber'
import isObject from 'lodash/isObject'
import isString from 'lodash/isString'
import * as R from 'ramda'
import * as React from 'react'
import * as M from '@material-ui/core'

import { doesTypeMatchSchema, schemaTypeToHumanString } from 'utils/json-schema'

import { COLUMN_IDS, EMPTY_VALUE } from './State'

const useStyles = M.makeStyles((t) => ({
  default: {
    color: t.palette.text.secondary,
  },
  mismatch: {
    color: t.palette.error.main,
  },
  notInSchema: {
    color: t.palette.text.secondary,
  },
}))

function getTypeAnnotationFromValue(value, schema) {
  return R.cond([
    [isArray, () => 'array'],
    [isObject, () => 'object'],
    [isString, () => (R.propOr([], 'enum', schema).includes(value) ? 'enum' : 'string')],
    [isNumber, () => 'number'],
    [isBoolean, () => 'boolean'],
    [isNull, () => 'null'],
    [R.T, () => 'undefined'],
  ])(value)
}

const getTypeAnnotation = (value, schema) =>
  value === EMPTY_VALUE
    ? schemaTypeToHumanString(schema)
    : getTypeAnnotationFromValue(value, schema)

function NoteValue({ schema, value }) {
  const classes = useStyles()

  const schemaType = schemaTypeToHumanString(schema)
  const mismatch = !doesTypeMatchSchema(value, schema)
  const typeNotInSchema = schemaType === 'undefined'
  const typeHelp = typeNotInSchema
    ? 'Key/value is not restricted by schema'
    : `Value should be of ${schemaType} type`

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
  if (columnId === COLUMN_IDS.VALUE) {
    return <NoteValue value={value} schema={data.valueSchema} />
  }

  return null
}
