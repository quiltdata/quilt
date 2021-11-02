import cx from 'classnames'
import * as R from 'ramda'
import * as React from 'react'
import * as M from '@material-ui/core'

import {
  JsonSchema,
  doesTypeMatchSchema,
  schemaTypeToHumanString,
} from 'utils/json-schema'

import { JsonValue, COLUMN_IDS, EMPTY_VALUE, RowData } from './constants'

const useStyles = M.makeStyles((t) => ({
  default: {
    color: t.palette.text.secondary,
    fontFamily: (t.typography as $TSFixMe).monospace.fontFamily,
    fontSize: t.typography.caption.fontSize,
  },
  mismatch: {
    color: t.palette.error.main,
  },
  notInSchema: {
    color: t.palette.text.secondary,
  },
}))

function getTypeAnnotationFromValue(value: JsonValue, schema?: JsonSchema): string {
  return R.cond<JsonValue, string>([
    [Array.isArray, () => 'array'],
    [
      R.is(String),
      () => (schema?.enum && schema.enum.includes(value) ? 'enum' : 'string'),
    ],
    [R.is(Number), () => 'number'],
    [R.is(Boolean), () => 'boolean'],
    [R.equals(null), () => 'null'],
    [R.is(Object), () => 'object'],
    [R.T, () => 'undefined'],
  ])(value)
}

const getTypeAnnotation = (value: JsonValue, schema?: JsonSchema): string =>
  value === EMPTY_VALUE
    ? schemaTypeToHumanString(schema)
    : getTypeAnnotationFromValue(value, schema)

interface TypeHelpProps {
  humanReadableSchema: string
  schema?: JsonSchema
}

function TypeHelp({ humanReadableSchema, schema }: TypeHelpProps) {
  if (humanReadableSchema === 'undefined')
    return <>Key/value is not restricted by schema</>

  return (
    <div>
      Type: {humanReadableSchema}
      {!!schema?.description && <p>Description: {schema.description}</p>}
    </div>
  )
}

interface NoteValueProps {
  schema?: JsonSchema
  value: JsonValue
}

function NoteValue({ schema, value }: NoteValueProps) {
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

interface NoteProps {
  columnId: 'key' | 'value'
  data: RowData
  value: JsonValue
}

export default function Note({ columnId, data, value }: NoteProps) {
  if (columnId === COLUMN_IDS.VALUE) {
    return <NoteValue value={value} schema={data.valueSchema} />
  }

  return null
}
