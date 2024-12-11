import type { ErrorObject } from 'ajv'
import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import JsonEditor from 'components/JsonEditor'
import JsonValidationErrors from 'components/JsonValidationErrors'
import { JsonSchema, makeSchemaValidator } from 'utils/JSONSchema'
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
  header: {
    marginBottom: t.spacing(2),
  },
}))

export interface QuiltConfigEditorProps {
  className?: string
  disabled?: boolean
  error: Error | null
  initialValue?: string
  onChange: (value: string) => void
}

interface QuiltConfigEditorEssentialProps {
  header: React.ReactNode
  schema?: JsonSchema
}

export default function QuiltConfigEditorSuspended({
  className,
  disabled,
  error,
  header,
  initialValue,
  onChange,
  schema,
}: QuiltConfigEditorProps & QuiltConfigEditorEssentialProps) {
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
    <div className={cx(classes.root, className)}>
      {!!header && <div className={classes.header}>{header}</div>}
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
