import * as FF from 'final-form'
import * as React from 'react'
import * as RF from 'react-final-form'
import * as M from '@material-ui/core'

import { loadMode } from 'components/FileEditor/loader'
import * as validators from 'utils/validators'

const TextEditor = React.lazy(() => import('components/FileEditor/TextEditor'))

const TEXT_EDITOR_TYPE = { brace: 'yaml' as const }

type YamlEditorFieldProps = RF.FieldRenderProps<string> & M.TextFieldProps

function YamlEditorField({ errors, input, meta }: YamlEditorFieldProps) {
  // TODO: convert yaml to json and validate with JSON Schema
  const error = meta.error || meta.submitError
  const errorMessage = meta.submitFailed && error ? errors[error] || error : undefined
  return (
    <TextEditor
      error={errorMessage ? new Error(errorMessage) : null}
      onChange={input.onChange}
      type={TEXT_EDITOR_TYPE}
      value={meta.initial}
    />
  )
}

interface LongQueryConfigProps {
  className?: string
}

export default function LongQueryConfig({ className }: LongQueryConfigProps) {
  loadMode('yaml')
  return (
    <div className={className}>
      <M.Typography variant="subtitle1" gutterBottom>
        First
      </M.Typography>
      <RF.Field
        component={YamlEditorField}
        name="config-first"
        label="FIXME"
        validate={validators.required as FF.FieldValidator<any>}
      />
      <M.Box mt={2} />
      <M.Typography variant="subtitle1" gutterBottom>
        Second
      </M.Typography>
      <RF.Field
        component={YamlEditorField}
        name="config-second"
        label="FIXME"
        validate={validators.required as FF.FieldValidator<any>}
      />
    </div>
  )
}
