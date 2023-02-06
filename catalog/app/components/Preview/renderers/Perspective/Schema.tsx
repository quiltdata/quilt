import Ajv from 'ajv'
import brace from 'brace'
import { JsonEditor as ReactJsonEditor } from 'jsoneditor-react'
import * as React from 'react'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import type { PerspectiveSchema } from 'utils/perspective'

const ajv = new Ajv({ allErrors: true, verbose: true })

const editorHtmlProps = { style: { height: '240px' } }

const jsonSchemaOfPerspectiveSchema = {
  type: 'object',
  additionalProperties: {
    type: 'string',
    default: 'string',
  },
}

interface SchemaEditorProps {
  initialValue: PerspectiveSchema
  onClose: () => void
  onSubmit: (s: PerspectiveSchema) => void
  open: boolean
}

export default function SchemaEditor({
  initialValue,
  onClose,
  onSubmit,
  open,
}: SchemaEditorProps) {
  const [error, setError] = React.useState<Error | null>(null)
  const [value, setValue] = React.useState(initialValue)
  const [submitted, setSubmitted] = React.useState(false)
  const handleChange = React.useCallback((v) => {
    setValue(v)
    setSubmitted(false)
  }, [])
  const handleSubmit = React.useCallback(() => {
    setSubmitted(true)
    try {
      onSubmit(value)
    } catch (e) {
      if (e instanceof Error) setError(e)
    }
    onClose()
  }, [onClose, onSubmit, value])
  return (
    <M.Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <M.DialogTitle>Change table Schema</M.DialogTitle>
      <M.DialogContent>
        <ReactJsonEditor
          ace={brace}
          ajv={ajv}
          htmlElementProps={editorHtmlProps}
          mainMenuBar={false}
          mode="code"
          navigationBar={false}
          onChange={handleChange}
          onError={setError}
          onValidationError={(es) => setError(es[0])}
          schema={jsonSchemaOfPerspectiveSchema}
          search={false}
          statusBar={false}
          theme="ace/theme/eclipse"
          value={initialValue}
        />
        {!!error && submitted && (
          <Lab.Alert key={error.message} severity="error">
            {error.message}
          </Lab.Alert>
        )}
      </M.DialogContent>
      <M.DialogActions>
        <M.Button>Cancel</M.Button>
        <M.Button onClick={handleSubmit}>Submit</M.Button>
      </M.DialogActions>
    </M.Dialog>
  )
}
