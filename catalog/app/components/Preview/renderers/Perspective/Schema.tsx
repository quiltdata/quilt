// import Ajv from 'ajv'
// import brace from 'brace'
// import { JsonEditor as ReactJsonEditor } from 'jsoneditor-react'
import * as React from 'react'
import * as M from '@material-ui/core'

import type { PerspectiveSchema } from 'utils/perspective'

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
  const [valueStr, setValueStr] = React.useState(JSON.stringify(initialValue, null, 2))
  const handleChange = React.useCallback((e) => setValueStr(e.target.value), [])
  const handleSubmit = React.useCallback(() => {
    try {
      onSubmit(JSON.parse(valueStr))
    } catch (e) {
      if (e instanceof Error) setError(e)
    }
    onClose()
  }, [onClose, onSubmit, valueStr])
  return (
    <M.Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <M.DialogTitle>Change table Schema</M.DialogTitle>
      <M.DialogContent>
        <textarea
          value={valueStr}
          onChange={handleChange}
          style={{ minHeight: '300px' }}
        />
      </M.DialogContent>
      <M.DialogActions>
        <M.Button>Cancel</M.Button>
        <M.Button onClick={handleSubmit}>Submit</M.Button>
      </M.DialogActions>
    </M.Dialog>
  )
}
