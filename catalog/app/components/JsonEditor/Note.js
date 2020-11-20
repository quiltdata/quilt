import cx from 'classnames'
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
    [Array.isArray, () => 'array'],
    [
      R.is(String),
      () => (R.propOr([], 'enum', schema).includes(value) ? 'enum' : 'string'),
    ],
    [R.is(Number), () => 'number'],
    [R.is(Boolean), () => 'boolean'],
    [R.equals(null), () => 'null'],
    [R.is(Object), () => 'object'],
    [R.T, () => 'undefined'],
  ])(value)
}

const getTypeAnnotation = (value, schema) =>
  value === EMPTY_VALUE
    ? schemaTypeToHumanString(schema)
    : getTypeAnnotationFromValue(value, schema)

function TypeHelp({ humanReadableSchema, schema }) {
  if (humanReadableSchema === 'undefined') return 'Key/value is not restricted by schema'

  return (
    <div>
      Value should be of {humanReadableSchema} type
      {R.prop('description', schema) && <p>{schema.description}</p>}
    </div>
  )
}

function NoteValue({ schema, value }) {
  const classes = useStyles()

  const humanReadableSchema = schemaTypeToHumanString(schema)
  const mismatch = value !== EMPTY_VALUE && !doesTypeMatchSchema(value, schema)

  return (
    <M.Tooltip title={<TypeHelp {...{ humanReadableSchema, schema }} />}>
      <span
        className={cx(classes.default, {
          [classes.mismatch]: mismatch,
          [classes.notInSchema]: humanReadableSchema === 'undefined',
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
