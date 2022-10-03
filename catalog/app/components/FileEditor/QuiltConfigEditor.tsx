import * as React from 'react'
import * as M from '@material-ui/core'

import JsonEditor from 'components/JsonEditor'
// import bucketPreferencesSchema from 'schemas/bucketConfig.yml.json'
import JsonValidationErrors from 'components/JsonValidationErrors'
import * as YAML from 'utils/yaml'

const useStyles = M.makeStyles((t) => ({
  errors: {
    marginTop: t.spacing(1),
  },
}))

interface QuiltConfigEditorProps {
  disabled?: boolean
  onChange: (value: string) => void
  initialValue?: string
  error: Error | null
}

export default function QuiltConfigEditor({
  disabled,
  onChange,
  initialValue,
  error,
}: QuiltConfigEditorProps) {
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
      />
      <JsonValidationErrors className={classes.errors} error={errors} />
    </>
  )
}
