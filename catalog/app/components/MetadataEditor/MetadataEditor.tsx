import Ajv from 'ajv'
import brace from 'brace'
import * as React from 'react'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import { JsonEditor as ReactJsonEditor } from 'jsoneditor-react'
import JsonEditor from 'components/JsonEditor'
import { JsonValue } from 'components/JsonEditor/constants'

import 'brace/mode/json'
import 'brace/theme/eclipse'
import 'jsoneditor-react/es/editor.min.css'

const ajv = new Ajv({ allErrors: true, verbose: true })

interface MetadataEditorProps {
  isRaw: boolean
  isMultiColumned: boolean
  value: JsonValue
  onChange: (value: JsonValue) => void
}

export default function MetadataEditor({ isRaw, value, onChange }: MetadataEditorProps) {
  const [errors, setErrors] = React.useState<Error[]>([])
  const t = M.useTheme()
  const editorHtmlProps = React.useMemo(
    () => ({
      style: { height: t.spacing(30) },
    }),
    [t],
  )
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
          //   schema={schema}
          search={false}
          statusBar={false}
          theme="ace/theme/eclipse"
          value={value || {}}
        />
      ) : (
        <JsonEditor isMultiColumned value={value} onChange={onChange} />
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
