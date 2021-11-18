import Ajv, { ErrorObject } from 'ajv'
import brace from 'brace'
import { JsonEditor as ReactJsonEditor } from 'jsoneditor-react'
import * as React from 'react'
import * as M from '@material-ui/core'

import JsonEditor from 'components/JsonEditor'
import { JsonValue } from 'components/JsonEditor/constants'
import JsonValidationErrors from 'components/JsonValidationErrors'
import { JsonSchema, makeSchemaValidator } from 'utils/json-schema'

import 'brace/mode/json'
import 'brace/theme/eclipse'
import 'jsoneditor-react/es/editor.min.css'

const ajv = new Ajv({ allErrors: true, verbose: true })

const editorHtmlProps = {
  style: { flexGrow: 1 },
}

const useStyles = M.makeStyles((t) => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  },
  error: {
    margin: t.spacing(1, 0, 0),
  },
}))

interface MetadataEditorProps {
  isRaw: boolean
  multiColumned: boolean
  onChange: (value: JsonValue) => void
  schema?: JsonSchema
  value: JsonValue
}

export default function MetadataEditor({
  isRaw,
  multiColumned,
  onChange,
  schema,
  value,
}: MetadataEditorProps) {
  const classes = useStyles()
  const schemaValidator = React.useMemo(() => makeSchemaValidator(schema), [schema])
  const [errors, setErrors] = React.useState<(Error | ErrorObject)[]>(() =>
    schemaValidator(value),
  )

  const handleChange = React.useCallback(
    (newValue: JsonValue) => {
      setErrors(schemaValidator(newValue))
      onChange(newValue)
    },
    [onChange, schemaValidator],
  )
  return (
    <div className={classes.root}>
      {isRaw ? (
        <ReactJsonEditor
          ace={brace}
          ajv={ajv}
          htmlElementProps={editorHtmlProps}
          mainMenuBar={false}
          mode="code"
          navigationBar={false}
          onChange={onChange}
          onError={(e) => setErrors([e])}
          onValidationError={setErrors}
          schema={schema}
          search={false}
          statusBar={true}
          theme="ace/theme/eclipse"
          value={value || {}}
        />
      ) : (
        <JsonEditor
          multiColumned={multiColumned}
          value={value}
          onChange={handleChange}
          schema={schema}
        />
      )}

      <JsonValidationErrors className={classes.error} error={errors} />
    </div>
  )
}
