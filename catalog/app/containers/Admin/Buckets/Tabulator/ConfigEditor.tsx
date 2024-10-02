import * as React from 'react'
import * as FF from 'final-form'
import * as RF from 'react-final-form'
import * as M from '@material-ui/core'

import tabulatorTableSchema from 'schemas/tabulatorTable.yml.json'

import TextEditor from 'components/FileEditor/TextEditor'
import { loadMode } from 'components/FileEditor/loader'
import { JsonInvalidAgainstSchema } from 'utils/error'
import { makeSchemaValidator } from 'utils/json-schema'
import * as yaml from 'utils/yaml'

const TEXT_EDITOR_TYPE = { brace: 'yaml' as const }

type ConfigEditorFieldProps = RF.FieldRenderProps<string> &
  M.TextFieldProps & { className: string }

export function ConfigEditor({ errors, input, meta, ...props }: ConfigEditorFieldProps) {
  loadMode(TEXT_EDITOR_TYPE.brace)

  const error = meta.error || meta.submitError
  const errorMessage = meta.submitFailed && error ? errors[error] || error : undefined

  const [key, setKey] = React.useState(0)
  React.useEffect(() => {
    // Reset the editor state when the state is reset outside
    if (!meta.modified) setKey((k) => k + 1)
  }, [meta.modified])

  return (
    <TextEditor
      {...props}
      key={key}
      error={errorMessage ? new Error(errorMessage) : null}
      initialValue={meta.initial}
      leadingChange={false}
      onChange={input.onChange}
      type={TEXT_EDITOR_TYPE}
    />
  )
}

export const validateTable: FF.FieldValidator<string> = (inputStr?: string) => {
  try {
    const data = yaml.parse(inputStr)
    const validator = makeSchemaValidator(tabulatorTableSchema)
    const errors = validator(data)
    if (errors.length) {
      return new JsonInvalidAgainstSchema({ errors }).message
    }
    return undefined
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error)
    return 'invalid'
  }
}
