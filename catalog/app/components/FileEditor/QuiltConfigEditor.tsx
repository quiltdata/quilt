import * as React from 'react'
import * as M from '@material-ui/core'

import JsonEditor from 'components/JsonEditor'
import JsonValidationErrors from 'components/JsonValidationErrors'
import type { S3HandleBase } from 'utils/s3paths'
import * as YAML from 'utils/yaml'

import Skeleton from './Skeleton'

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

function JsonEditorSuspended({
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

export default function QuiltConfigEditor(
  props: QuiltConfigEditorProps & { handle: S3HandleBase },
) {
  return (
    <React.Suspense fallback={<Skeleton />}>
      <JsonEditorSuspended {...props} />
    </React.Suspense>
  )
}
