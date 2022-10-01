import * as React from 'react'

import JsonEditor from 'components/JsonEditor'
// import bucketPreferencesSchema from 'schemas/bucketConfig.yml.json'
import parseYaml from 'utils/yaml'

interface QuiltConfigEditorProps {
  disabled?: boolean
  onChange: (value: string) => void
  value?: string
  error: Error | null
}

export default function QuiltConfigEditor({
  disabled,
  onChange,
  value,
  error,
}: QuiltConfigEditorProps) {
  const errors = error ? [error] : []
  const parsed = parseYaml(value)
  const handleChange = React.useCallback(() => {
    onChange('')
  }, [onChange])
  return (
    <JsonEditor
      disabled={disabled}
      errors={errors}
      multiColumned
      onChange={handleChange}
      value={parsed}
    />
  )
}
