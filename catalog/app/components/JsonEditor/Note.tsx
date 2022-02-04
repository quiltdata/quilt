import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import {
  JsonSchema,
  doesTypeMatchSchema,
  schemaTypeToHumanString,
} from 'utils/json-schema'

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

interface TypeHelpArgs {
  errors: ValidationErrors
  humanReadableSchema: string
  mismatch: boolean
  schema?: JsonSchema
}

function getTypeHelps({ errors, humanReadableSchema, mismatch, schema }: TypeHelpArgs) {
  const output: string[][] = []

  if (errors.length) {
    output.push(errors.filter(Boolean).map(({ message }) => message) as string[])
  }

  if (humanReadableSchema) {
    if (humanReadableSchema === 'undefined') {
      output.push(['Key/value is not restricted by schema'])
    } else {
      output.push([`${mismatch ? 'Required type' : 'Type'}: ${humanReadableSchema}`])
    }
  }

  if (schema?.description) {
    output.push([`Description: ${schema.description}`])
  }

  return output
}

interface TypeHelpProps {
  typeHelps: string[][]
}

function TypeHelp({ typeHelps: groups }: TypeHelpProps) {
  return (
    <div>
      {groups.map((group, i) => (
        <div key={`typeHelp_group_${i}`}>
          {i > 0 && <hr key={`typeHelp_group_${i}`} />}
          {group.map((typeHelp, j) => (
            <p key={`typeHelp_${i}_${j}`}>{typeHelp}</p>
          ))}
        </div>
      ))}
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

  const typeHelps = React.useMemo(
    () => getTypeHelps({ errors, humanReadableSchema, mismatch, schema }),
    [errors, humanReadableSchema, mismatch, schema],
  )
  if (!typeHelps.length) return null

  return (
    <M.Tooltip title={<TypeHelp typeHelps={typeHelps} />}>
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
