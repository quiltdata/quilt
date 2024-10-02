import * as React from 'react'
import * as RF from 'react-final-form'
import * as M from '@material-ui/core'

import { loadMode } from 'components/FileEditor/loader'

const TextEditor = React.lazy(() => import('components/FileEditor/TextEditor'))

const TEXT_EDITOR_TYPE = { brace: 'yaml' as const }

type ConfigEditorFieldProps = RF.FieldRenderProps<string> &
  M.TextFieldProps & { className: string }

export default function ConfigEditor({
  errors,
  input,
  meta,
  ...props
}: ConfigEditorFieldProps) {
  loadMode('yaml')

  const error = meta.error || meta.submitError
  const errorMessage = meta.submitFailed && error ? errors[error] || error : undefined

  const [key, setKey] = React.useState(0)
  const reset = React.useCallback(() => setKey((k) => k + 1), [])
  React.useEffect(() => {
    if (meta.pristine) reset()
  }, [meta.pristine, reset])

  return (
    <TextEditor
      {...props}
      error={errorMessage ? new Error(errorMessage) : null}
      initialValue={meta.initial}
      key={key}
      leadingChange={false}
      onChange={input.onChange}
      type={TEXT_EDITOR_TYPE}
    />
  )
}
