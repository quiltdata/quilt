import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import Code from 'components/Code'
import StyledTooltip from 'utils/StyledTooltip'
import {
  JsonSchema,
  doesTypeMatchSchema,
  schemaTypeToHumanString,
} from 'utils/json-schema'
import { printObject } from 'utils/string'

import {
  JsonValue,
  COLUMN_IDS,
  EMPTY_VALUE,
  RowData,
  ValidationErrors,
} from './constants'

interface TypeHelpArgs {
  errors: ValidationErrors
  humanReadableSchema: string
  mismatch: boolean
  schema?: JsonSchema
}

function getExamples(examples: JsonValue[]) {
  const title = `Example${examples.length ? 's' : ''}:`
  return [
    title,
    ...examples.map((example, i) => {
      const str = printObject(example)
      return <Code key={str + i}>{str}</Code>
    }),
  ]
}

function getTypeHelps({ errors, humanReadableSchema, mismatch, schema }: TypeHelpArgs) {
  const output: React.ReactNode[][] = []

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

  if (schema?.examples && schema.examples.length) {
    output.push(getExamples(schema.examples))
  }

  return output
}

const useTypeHelpStyles = M.makeStyles((t) => ({
  group: {
    '& + &': {
      borderTop: `1px solid ${t.palette.divider}`,
      marginTop: t.spacing(1),
      paddingTop: t.spacing(1),
    },
  },
  item: {
    margin: t.spacing(0.5, 0, 0),
  },
}))

interface TypeHelpProps {
  typeHelps: React.ReactNode[][]
}

function TypeHelp({ typeHelps: groups }: TypeHelpProps) {
  const classes = useTypeHelpStyles()
  return (
    <div>
      {groups.map((group, i) => (
        <div className={classes.group} key={`typeHelp_group_${i}`}>
          {group.map((typeHelp, j) => (
            <p className={classes.item} key={`typeHelp_${i}_${j}`}>
              {typeHelp}
            </p>
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

const useNoteValueStyles = M.makeStyles((t) => ({
  default: {
    color: t.palette.divider,
    fontFamily: t.typography.monospace.fontFamily,
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

function NoteValue({ errors, schema, value }: NoteValueProps) {
  const classes = useNoteValueStyles()

  const humanReadableSchema = schemaTypeToHumanString(schema)
  const mismatch = value !== EMPTY_VALUE && !doesTypeMatchSchema(value, schema)

  const typeHelps = React.useMemo(
    () => getTypeHelps({ errors, humanReadableSchema, mismatch, schema }),
    [errors, humanReadableSchema, mismatch, schema],
  )
  if (!typeHelps.length) return null

  return (
    <StyledTooltip title={<TypeHelp typeHelps={typeHelps} />}>
      <span
        className={cx(classes.default, {
          [classes.mismatch]: mismatch,
        })}
      >
        {<M.Icon>info_outlined</M.Icon>}
      </span>
    </StyledTooltip>
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
