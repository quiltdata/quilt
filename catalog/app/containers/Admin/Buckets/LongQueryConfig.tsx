import * as FF from 'final-form'
import * as React from 'react'
import * as RF from 'react-final-form'
import * as RFA from 'react-final-form-arrays'
import * as M from '@material-ui/core'

import { loadMode } from 'components/FileEditor/loader'
import * as Model from 'model'
import * as validators from 'utils/validators'

const TextEditor = React.lazy(() => import('components/FileEditor/TextEditor'))

const TEXT_EDITOR_TYPE = { brace: 'yaml' as const }

type YamlEditorFieldProps = RF.FieldRenderProps<Model.GQLTypes.TabulatorTable> &
  M.TextFieldProps

function YamlEditorField({ className, errors, input, meta }: YamlEditorFieldProps) {
  // TODO: convert yaml to json and validate with JSON Schema
  const error = meta.error || meta.submitError
  const errorMessage = meta.submitFailed && error ? errors[error] || error : undefined
  return (
    <div className={className}>
      <M.Typography variant="subtitle1" gutterBottom>
        {meta.initial?.name}
      </M.Typography>
      <TextEditor
        error={errorMessage ? new Error(errorMessage) : null}
        onChange={input.onChange}
        type={TEXT_EDITOR_TYPE}
        value={meta.initial?.config}
      />
    </div>
  )
}

const useLongQueryConfigFormStyles = M.makeStyles((t) => ({
  field: {
    '& + &': {
      marginTop: t.spacing(2),
    },
  },
}))

interface LongQueryConfigFormProps {
  className?: string
  children?: React.ReactNode
}

export default function LongQueryConfigForm({
  children,
  className,
}: LongQueryConfigFormProps) {
  const classes = useLongQueryConfigFormStyles()
  loadMode('yaml')
  return (
    <div className={className}>
      <RFA.FieldArray name="tabulatorTables">
        {({ fields }) =>
          fields.map((name) => (
            <RF.Field
              className={classes.field}
              component={YamlEditorField}
              key={name}
              name={`${name}`}
              validate={validators.required as FF.FieldValidator<any>}
            />
          ))
        }
      </RFA.FieldArray>
      {children}
    </div>
  )
}
