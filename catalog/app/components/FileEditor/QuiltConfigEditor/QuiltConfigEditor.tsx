import * as React from 'react'
import * as M from '@material-ui/core'

import JsonEditor from 'components/JsonEditor'
import JsonValidationErrors from 'components/JsonValidationErrors'
import type { JsonSchema } from 'utils/json-schema'
import * as YAML from 'utils/yaml'

const useStyles = M.makeStyles((t) => ({
  errors: {
    marginTop: t.spacing(1),
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
}: QuiltConfigEditorProps & { schema?: JsonSchema }) {
  const classes = useStyles()
  const errors = error ? [error] : []
  const [value, setValue] = React.useState(YAML.parse(initialValue))
  const handleChange = React.useCallback(
    (json) => {
      setValue(json)
      onChange(YAML.stringify(json))
    },
    [onChange],
  )
  return (
    <>
      <JsonEditor
        disabled={disabled}
        errors={errors}
        multiColumned
        onChange={handleChange}
        value={value}
        schema={schema}
      />
      <JsonValidationErrors className={classes.errors} error={errors} />
    </>
  )
}
