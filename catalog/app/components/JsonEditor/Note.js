import * as R from 'ramda'
import * as React from 'react'
import cx from 'classnames'
import isArray from 'lodash/isArray'
import isNumber from 'lodash/isNumber'
import isObject from 'lodash/isObject'
import isString from 'lodash/isString'

import * as M from '@material-ui/core'

import { doesTypeMatchToSchema, schemaTypetoHumanString } from 'utils/json-schema'

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

function getTypeAnnotation(value, schema) {
  if (value === EmptyValue) {
    return schemaTypetoHumanString(schema)
  }

  return getTypeAnnotationFromValue(value, schema)
}

function NoteValue({ schema, value }) {
  const classes = useStyles()

  const schemaType = schemaTypetoHumanString(schema)
  const mismatch = !doesTypeMatchToSchema(value, schema)
  const typeNotInSchema = schemaType === 'none'
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
  if (columnId === ColumnIds.Value) {
    return <NoteValue value={value} schema={data.valueSchema} />
  }

  return null
}
