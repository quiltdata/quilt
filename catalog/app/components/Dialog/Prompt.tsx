import * as R from 'ramda'
import * as React from 'react'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

interface DialogProps {
  initialValue?: string
  onCancel: () => void
  onSubmit: (value: string) => void
  open: boolean
  title: string
  validate: (value: string) => Error | undefined
}

function Dialog({
  initialValue,
  open,
  onCancel,
  onSubmit,
  title,
  validate,
}: DialogProps) {
  const [value, setValue] = React.useState(initialValue || '')
  const [submitted, setSubmitted] = React.useState(false)
  const error = React.useMemo(() => validate(value), [validate, value])
  const handleChange = React.useCallback((event) => setValue(event.target.value), [])
  const handleSubmit = React.useCallback(
    (event) => {
      event.preventDefault()
      setSubmitted(true)
      if (!error) onSubmit(value)
    },
    [error, onSubmit, value],
  )
  return (
    <M.Dialog open={open} fullWidth maxWidth="sm">
      <form onSubmit={handleSubmit}>
        <M.DialogTitle>{title}</M.DialogTitle>
        <M.DialogContent>
          <M.TextField
            autoFocus
            fullWidth
            margin="dense"
            onChange={handleChange}
            value={value}
          />
          {!!error && !!submitted && (
            <Lab.Alert severity="error">{error.message}</Lab.Alert>
          )}
        </M.DialogContent>
        <M.DialogActions>
          <M.Button onClick={onCancel} color="primary" variant="outlined">
            Cancel
          </M.Button>
          <M.Button
            color="primary"
            disabled={!!error && !!submitted}
            onClick={handleSubmit}
            variant="contained"
          >
            Submit
          </M.Button>
        </M.DialogActions>
      </form>
    </M.Dialog>
  )
}

interface PromptProps {
  initialValue?: string
  onSubmit: (value: string) => void
  title: string
  validate: (value: string) => Error | undefined
}

export function usePrompt({ initialValue, title, onSubmit, validate }: PromptProps) {
  const [key, setKey] = React.useState(0)
  const [opened, setOpened] = React.useState(false)
  const open = React.useCallback(() => setOpened(true), [])
  const close = React.useCallback(() => {
    setOpened(false)
    setKey(R.inc)
  }, [])
  const handleSubmit = React.useCallback(
    (value: string) => {
      onSubmit(value)
      close()
    },
    [close, onSubmit],
  )
  const render = React.useCallback(
    () => (
      <Dialog
        {...{
          initialValue,
          key,
          onCancel: close,
          onSubmit: handleSubmit,
          open: opened,
          title,
          validate,
        }}
      />
    ),
    [initialValue, key, close, handleSubmit, opened, title, validate],
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
