import Ajv from 'ajv'
import brace from 'brace'
import { JsonEditor as ReactJsonEditor } from 'jsoneditor-react'
import * as React from 'react'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import type { PerspectiveSchema } from 'utils/perspective'

const ajv = new Ajv({ allErrors: true, verbose: true })

const jsonSchemaOfPerspectiveSchema = {
  type: 'object',
  additionalProperties: {
    type: 'string',
    default: 'string',
  },
}

const useStyles = M.makeStyles((t) => ({
  reset: {
    marginRight: 'auto',
  },
  editor: {
    height: t.spacing(30),
  },
  error: {
    marginTop: t.spacing(0.5),
  },
}))

interface SchemaEditorProps {
  initialValue: PerspectiveSchema
  onClose: () => void
  onReset: () => void
  onSubmit: (s: PerspectiveSchema) => void
  open: boolean
}

export default function SchemaEditor({
  initialValue,
  onClose,
  onSubmit,
  onReset,
  open,
}: SchemaEditorProps) {
  const classes = useStyles()
  const [error, setError] = React.useState<Error | null>(null)
  const [value, setValue] = React.useState(initialValue)
  const [submitted, setSubmitted] = React.useState(false)
  const handleReset = React.useCallback(() => {
    onReset()
    onClose()
  }, [onClose, onReset])
  const handleChange = React.useCallback((v) => {
    setValue(v)
    setSubmitted(false)
  }, [])
  const handleSubmit = React.useCallback(() => {
    setSubmitted(true)
    if (error) return
    try {
      onSubmit(value)
      onClose()
    } catch (e) {
      if (e instanceof Error) setError(e)
    }
  }, [error, onClose, onSubmit, value])
  const editorHtmlProps = React.useMemo(() => ({ className: classes.editor }), [classes])
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
          <Lab.Alert className={classes.error} key={error.message} severity="error">
            {error.message}
          </Lab.Alert>
        )}
      </M.DialogContent>
      <M.DialogActions>
        <M.Button onClick={handleReset} className={classes.reset}>
          Reset
        </M.Button>
        <M.Button onClick={onClose}>Cancel</M.Button>
        <M.Button variant="contained" color="primary" onClick={handleSubmit}>
          Submit
        </M.Button>
      </M.DialogActions>
    </M.Dialog>
  )
}
