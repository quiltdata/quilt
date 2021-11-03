import Ajv from 'ajv'
import brace from 'brace'
import { JsonEditor as ReactJsonEditor } from 'jsoneditor-react'
import * as React from 'react'
import * as Lab from '@material-ui/lab'

import JsonEditor from 'components/JsonEditor'
import { JsonValue } from 'components/JsonEditor/constants'
import { JsonSchema } from 'utils/json-schema'

import 'brace/mode/json'
import 'brace/theme/eclipse'
import 'jsoneditor-react/es/editor.min.css'

const ajv = new Ajv({ allErrors: true, verbose: true })

const editorHtmlProps = {
  style: { height: '100%' },
}

interface MetadataEditorProps {
  isMultiColumned: boolean
  isRaw: boolean
  onChange: (value: JsonValue) => void
  schema?: JsonSchema
  value: JsonValue
}

export default function MetadataEditor({
  isRaw,
  onChange,
  schema,
  value,
}: MetadataEditorProps) {
  const [errors, setErrors] = React.useState<Error[]>([])
  return (
    <>
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
          statusBar={false}
          theme="ace/theme/eclipse"
          value={value || {}}
        />
      ) : (
        <JsonEditor isMultiColumned value={value} onChange={onChange} schema={schema} />
      )}

      {!!errors.length &&
        errors.map((error) => (
          <Lab.Alert key={error.message} severity="error">
            {error.message}
          </Lab.Alert>
        ))}
    </>
  )
}
