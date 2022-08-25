import * as React from 'react'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

interface DialogProps {
  onCancel: () => void
  onSubmit: (value: string) => void
  open: boolean
  title: string
  validate: (value: string) => Error | undefined
}

// TODO: default value
function Dialog({ open, onCancel, onSubmit, title, validate }: DialogProps) {
  const [value, setValue] = React.useState('Readme.md')
  const error = React.useMemo(() => validate(value), [validate, value])
  const handleChange = React.useCallback((event) => setValue(event.target.value), [])
  const handleSubmit = React.useCallback(() => onSubmit(value), [onSubmit, value])
  return (
    <M.Dialog open={open} fullWidth maxWidth="sm">
      <M.DialogTitle>{title}</M.DialogTitle>
      <M.DialogContent>
        <M.TextField
          autoFocus
          fullWidth
          margin="dense"
          onChange={handleChange}
          value={value}
        />
        {!!error && <Lab.Alert severity="error">{error.message}</Lab.Alert>}
      </M.DialogContent>
      <M.DialogActions>
        <M.Button onClick={onCancel} color="primary" variant="outlined">
          Cancel
        </M.Button>
        <M.Button onClick={handleSubmit} color="primary" variant="contained">
          Submit
        </M.Button>
      </M.DialogActions>
    </M.Dialog>
  )
}

interface PromptProps {
  title: string
  onSubmit: (value: string) => void
  validate: (value: string) => Error | undefined
}
export function usePrompt({ title, onSubmit, validate }: PromptProps) {
  const [opened, setOpened] = React.useState(false)
  const open = React.useCallback(() => setOpened(true), [])
  const close = React.useCallback(() => setOpened(false), [])
  const render = React.useCallback(
    () => <Dialog {...{ title, open: opened, onCancel: close, onSubmit, validate }} />,
    [close, opened, onSubmit, title, validate],
  )
  return React.useMemo(
    () => ({
      close,
      open,
      render,
    }),
    [close, open, render],
  )
}
