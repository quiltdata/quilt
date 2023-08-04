import * as R from 'ramda'
import * as React from 'react'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

interface DialogProps {
  cancelTitle?: string
  initialValue?: string
  onCancel: () => void
  onSubmit: (e: React.FormEvent, v: string) => void
  open: boolean
  submitTitle?: string
  title: string
  validate: (value: string) => Error | undefined
}

function Dialog({
  cancelTitle = 'Cancel',
  initialValue,
  open,
  onCancel,
  onSubmit,
  submitTitle = 'Submit',
  title,
  validate,
}: DialogProps) {
  const [value, setValue] = React.useState(initialValue || '')
  const [submitted, setSubmitted] = React.useState(false)
  const error = React.useMemo(() => validate(value), [validate, value])
  const handleChange = React.useCallback((event) => setValue(event.target.value), [])
  const handleSubmit = React.useCallback(
    (event: React.FormEvent) => {
      // event.stopPropagation()
      event.preventDefault()
      setSubmitted(true)
      if (!error) onSubmit(event, value)
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
            {cancelTitle}
          </M.Button>
          <M.Button
            color="primary"
            disabled={!!error && !!submitted}
            onClick={handleSubmit}
            variant="contained"
          >
            {submitTitle}
          </M.Button>
        </M.DialogActions>
      </form>
    </M.Dialog>
  )
}

interface PromptProps {
  cancelTitle?: string
  initialValue?: string
  onSubmit: (e: React.FormEvent, v: string) => void
  submitTitle?: string
  title: string
  validate: (value: string) => Error | undefined
}

export function usePrompt({
  cancelTitle,
  initialValue,
  onSubmit,
  submitTitle,
  title,
  validate,
}: PromptProps) {
  const [key, setKey] = React.useState(0)
  const [opened, setOpened] = React.useState(false)
  const open = React.useCallback(() => {
    setKey(R.inc)
    setOpened(true)
  }, [])
  const close = React.useCallback(() => setOpened(false), [])
  const handleSubmit = React.useCallback(
    (...args: [React.FormEvent, string]) => {
      onSubmit(...args)
      close()
    },
    [close, onSubmit],
  )
  const render = React.useCallback(
    () => (
      <Dialog
        {...{
          cancelTitle,
          initialValue,
          key,
          onCancel: close,
          onSubmit: handleSubmit,
          open: opened,
          submitTitle,
          title,
          validate,
        }}
      />
    ),
    [
      cancelTitle,
      close,
      handleSubmit,
      initialValue,
      key,
      opened,
      submitTitle,
      title,
      validate,
    ],
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
