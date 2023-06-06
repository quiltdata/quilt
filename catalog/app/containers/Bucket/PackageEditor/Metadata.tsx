import * as React from 'react'
import * as M from '@material-ui/core'

import L from 'constants/loading'
import JsonEditor from 'components/JsonEditor'
import type { ValidationErrors } from 'components/JsonEditor/constants'
import JsonValidationErrors from 'components/JsonValidationErrors'
import type * as Types from 'utils/types'
import type { Schema } from 'utils/workflows'

import { MetaInputSkeleton } from '../PackageDialog/Skeleton'

import * as State from './State'

const useStyles = M.makeStyles((t) => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
  },
  errors: {
    marginTop: t.spacing(1),
  },
}))

interface MetadataProps {
  errors: ValidationErrors
  onChange: (v: Types.JsonRecord) => void
  schema?: Schema
  submitting: boolean
  value?: Types.JsonRecord
}

function Metadata({ errors, onChange, schema, submitting, value }: MetadataProps) {
  const classes = useStyles()
  return (
    <div className={classes.root}>
      <JsonEditor
        disabled={submitting}
        errors={errors}
        multiColumned
        onChange={onChange}
        schema={schema}
        value={value}
      />
      <JsonValidationErrors className={classes.errors} error={errors} />
    </div>
  )
}

export default function MetadataContainer() {
  const {
    main,
    fields: { meta },
  } = State.use()

  if (meta.state === L || meta.state.schema === L || meta.state.value === L) {
    return <MetaInputSkeleton />
  }

  return (
    <Metadata
      errors={meta.state.errors || []}
      onChange={meta.actions.onChange}
      schema={meta.state.schema}
      submitting={main.state.status === L}
      value={meta.state.value}
    />
  )
}
