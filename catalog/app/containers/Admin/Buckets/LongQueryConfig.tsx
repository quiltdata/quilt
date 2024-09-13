import * as FF from 'final-form'
import * as React from 'react'
import * as RF from 'react-final-form'
import * as RFA from 'react-final-form-arrays'
import * as M from '@material-ui/core'

import { loadMode } from 'components/FileEditor/loader'
import * as validators from 'utils/validators'
import * as yaml from 'utils/yaml'

import * as Form from '../Form'

const TextEditor = React.lazy(() => import('components/FileEditor/TextEditor'))

const TEXT_EDITOR_TYPE = { brace: 'yaml' as const }

type YamlEditorFieldProps = RF.FieldRenderProps<string> & M.TextFieldProps

function YamlEditorField({ errors, input, meta }: YamlEditorFieldProps) {
  // TODO: convert yaml to json and validate with JSON Schema
  const error = meta.error || meta.submitError
  const errorMessage = meta.submitFailed && error ? errors[error] || error : undefined

  const [key, setKey] = React.useState(0)
  const reset = React.useCallback(() => setKey((k) => k + 1), [])
  React.useEffect(() => {
    if (meta.pristine) reset()
  }, [meta.pristine, reset])

  return (
    <TextEditor
      disabled={meta.submitting || meta.submitSucceeded}
      error={errorMessage ? new Error(errorMessage) : null}
      key={key}
      leadingChange={false}
      onChange={input.onChange}
      type={TEXT_EDITOR_TYPE}
      value={meta.initial}
    />
  )
}

const validateYaml: FF.FieldValidator<string> = (inputStr?: string) => {
  const error = yaml.validate(inputStr)
  if (error) {
    return 'invalid'
  }
}

const useLongQueryConfigFormStyles = M.makeStyles((t) => ({
  item: {
    marginBottom: t.spacing(2),
    '& + &': {
      marginTop: t.spacing(2),
    },
  },
  name: {
    marginBottom: t.spacing(1),
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
  // TODO:
  // useEffect -> if tabulatorTables is empty, add one
  return (
    <div className={className}>
      <RFA.FieldArray name="tabulatorTables">
        {({ fields }) => (
          <>
            {fields.map((name) => (
              <div className={classes.item} key={name}>
                <RF.Field
                  className={classes.name}
                  component={Form.Field}
                  fullWidth
                  label="Config name"
                  name={`${name}.name`}
                  errors={{
                    required: 'Enter a config name',
                  }}
                  validate={validators.required as FF.FieldValidator<any>}
                />
                <RF.Field
                  component={YamlEditorField}
                  name={`${name}.config`}
                  errors={{
                    required: 'Enter config content',
                    invalid: 'YAML is invalid',
                  }}
                  validate={validators.composeAnd(
                    validators.required as FF.FieldValidator<any>,
                    validateYaml,
                  )}
                />
              </div>
            ))}
            <M.Button
              type="button"
              onClick={() => fields.push({ name: '', config: '' })}
              startIcon={<M.Icon>add_circle</M.Icon>}
              variant="outlined"
            >
              Add
            </M.Button>
          </>
        )}
      </RFA.FieldArray>
      {children}
    </div>
  )
}
