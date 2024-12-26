import * as R from 'ramda'
import * as React from 'react'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

interface DialogProps {
  children: React.ReactNode
  initialValue?: string
  onCancel: () => void
  onSubmit: (value: string) => void
  open: boolean
  placeholder?: string
  title: string
  validate: (value: string) => Error | undefined
}

function Dialog({
  children,
  initialValue,
  onCancel,
  onSubmit,
  open,
  placeholder,
  title,
  validate,
}: DialogProps) {
  const [value, setValue] = React.useState(initialValue || '')
  const [submitted, setSubmitted] = React.useState(false)
  const error = React.useMemo(() => validate(value), [validate, value])
  const handleChange = React.useCallback((event) => setValue(event.target.value), [])
  const handleSubmit = React.useCallback(
    (event) => {
      event.stopPropagation()
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
          {children}
          <M.TextField
            autoFocus
            fullWidth
            margin="dense"
            onChange={handleChange}
            placeholder={placeholder}
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
  placeholder?: string
  title: string
  validate: (value: string) => Error | undefined
}

// TODO: Re-use utils/Dialog
export function usePrompt({
  onSubmit,
  initialValue,
  placeholder,
  validate,
  title,
}: PromptProps) {
  const [key, setKey] = React.useState(0)
  const [opened, setOpened] = React.useState(false)
  const open = React.useCallback(() => {
    setKey(R.inc)
    setOpened(true)
  }, [])
  const close = React.useCallback(() => setOpened(false), [])
  const handleSubmit = React.useCallback(
    (value: string) => {
      onSubmit(value)
      close()
    },
    [close, onSubmit],
  )
  const render = React.useCallback(
    (children?: React.ReactNode) => (
      <Dialog
        {...{
          children,
          initialValue,
          key,
          onCancel: close,
          onSubmit: handleSubmit,
          open: opened,
          placeholder,
          title,
          validate,
        }}
      />
    ),
    [close, handleSubmit, initialValue, key, opened, placeholder, title, validate],
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
