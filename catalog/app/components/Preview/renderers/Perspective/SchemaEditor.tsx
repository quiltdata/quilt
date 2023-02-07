import * as React from 'react'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import Placeholder from 'components/Placeholder'
import type { PerspectiveSchema } from 'utils/perspective'
import * as RT from 'utils/reactTools'

import type { EditorProps } from './Editor'

const SuspensePlaceholder = () => <Placeholder color="text.secondary" />
const Editor: React.FC<EditorProps> = RT.mkLazy(
  () => import('./Editor'),
  SuspensePlaceholder,
)

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
  const [errors, setError] = React.useState<Error[] | undefined>()
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
    if (errors && errors.length) return
    try {
      onSubmit(value)
      onClose()
    } catch (e) {
      if (e instanceof Error) setError([e])
    }
  }, [errors, onClose, onSubmit, value])
  return (
    <M.Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <M.DialogTitle>Change table Schema</M.DialogTitle>
      <M.DialogContent>
        <Editor
          className={classes.editor}
          onChange={handleChange}
          onError={setError}
          schema={jsonSchemaOfPerspectiveSchema}
          value={initialValue}
        />
        {submitted &&
          !!errors &&
          !!errors.length &&
          errors.map((error) => (
            <Lab.Alert className={classes.error} key={error.message} severity="error">
              {error.message}
            </Lab.Alert>
          ))}
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
