import cx from 'classnames'
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
    color: t.palette.divider,
    fontFamily: (t.typography as $TSFixMe).monospace.fontFamily,
    fontSize: t.typography.caption.fontSize,
    display: 'flex',
    '&:hover': {
      color: t.palette.text.disabled,
    },
  },
  mismatch: {
    color: t.palette.error.main,
  },
}))

interface TypeHelpProps {
  humanReadableSchema: string
  mismatch: boolean
  schema?: JsonSchema
}

function TypeHelp({ humanReadableSchema, mismatch, schema }: TypeHelpProps) {
  if (humanReadableSchema === 'undefined')
    return <>Key/value is not restricted by schema</>

  return (
    <div>
      {mismatch ? 'Required type: ' : 'Type: '}
      {humanReadableSchema}
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

  if (!humanReadableSchema || humanReadableSchema === 'undefined') return null

  return (
    <M.Tooltip title={<TypeHelp {...{ humanReadableSchema, mismatch, schema }} />}>
      <span
        className={cx(classes.default, {
          [classes.mismatch]: mismatch,
        })}
      >
        {mismatch ? <M.Icon>error_outlined</M.Icon> : <M.Icon>info_outlined</M.Icon>}
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
