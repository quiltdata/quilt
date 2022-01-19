import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import {
  JsonSchema,
  doesTypeMatchSchema,
  schemaTypeToHumanString,
} from 'utils/json-schema'
import * as RT from 'utils/reactTools'

import {
  JsonValue,
  COLUMN_IDS,
  EMPTY_VALUE,
  RowData,
  ValidationErrors,
} from './constants'

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
  errors: ValidationErrors
  humanReadableSchema: string
  mismatch: boolean
  schema?: JsonSchema
}

function TypeHelp({ errors, humanReadableSchema, mismatch, schema }: TypeHelpProps) {
  const validationError = React.useMemo(
    () =>
      RT.join(
        errors.map((error) => error.message),
        <br />,
      ),
    [errors],
  )

  if (humanReadableSchema === 'undefined')
    return <>Key/value is not restricted by schema</>

  const type = `${mismatch ? 'Required type' : 'Type'}: ${humanReadableSchema}`

  return (
    <div>
      {validationError || type}
      {!!schema?.description && <p>Description: {schema.description}</p>}
    </div>
  )
}

interface NoteValueProps {
  errors: ValidationErrors
  schema?: JsonSchema
  value: JsonValue
}

function NoteValue({ errors, schema, value }: NoteValueProps) {
  const classes = useStyles()

  const humanReadableSchema = schemaTypeToHumanString(schema)
  const mismatch = value !== EMPTY_VALUE && !doesTypeMatchSchema(value, schema)

  if (!humanReadableSchema || humanReadableSchema === 'undefined') return null

  return (
    <M.Tooltip
      title={<TypeHelp {...{ errors, humanReadableSchema, mismatch, schema }} />}
    >
      <span
        className={cx(classes.default, {
          [classes.mismatch]: mismatch,
        })}
      >
        {<M.Icon>info_outlined</M.Icon>}
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
    return <NoteValue errors={data.errors} schema={data.valueSchema} value={value} />
  }

  return null
}
