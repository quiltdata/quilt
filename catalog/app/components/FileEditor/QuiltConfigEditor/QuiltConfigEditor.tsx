import type { ErrorObject } from 'ajv'
import * as React from 'react'
import * as M from '@material-ui/core'

import JsonEditor from 'components/JsonEditor'
import JsonValidationErrors from 'components/JsonValidationErrors'
import { JsonSchema, makeSchemaValidator } from 'utils/json-schema'
import * as YAML from 'utils/yaml'

const useStyles = M.makeStyles((t) => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
  },
  errors: {
    marginTop: t.spacing(1),
  },
  toolbar: {
    marginBottom: t.spacing(2),
  },
}))

export interface QuiltConfigEditorProps {
  disabled?: boolean
  onChange: (value: string) => void
  initialValue?: string
  error: Error | null
}

export default function QuiltConfigEditorSuspended({
  disabled,
  onChange,
  initialValue,
  error,
  schema,
  toolbar,
}: QuiltConfigEditorProps & { schema?: JsonSchema; toolbar: React.ReactNode }) {
  const classes = useStyles()
  const validate = React.useMemo(() => makeSchemaValidator(schema), [schema])
  const [errors, setErrors] = React.useState<(Error | ErrorObject)[]>(
    error ? [error] : [],
  )
  const [value, setValue] = React.useState(YAML.parse(initialValue))
  const handleChange = React.useCallback(
    (json) => {
      setErrors(validate(json))
      setValue(json)
      onChange(YAML.stringify(json))
    },
    [onChange, validate],
  )
  return (
    <div className={classes.root}>
      {toolbar && <div className={classes.toolbar}>{toolbar}</div>}
      <JsonEditor
        disabled={disabled}
        errors={errors}
        multiColumned
        onChange={handleChange}
        value={value}
        schema={schema}
      />
      <JsonValidationErrors className={classes.errors} error={errors} />
    </div>
  )
}
