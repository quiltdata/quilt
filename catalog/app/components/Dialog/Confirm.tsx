import * as R from 'ramda'
import * as React from 'react'
import * as M from '@material-ui/core'

interface DialogProps {
  children: React.ReactNode
  onSubmit: (value: boolean) => void
  open: boolean
  title: string
}

function Dialog({ children, onSubmit, open, title }: DialogProps) {
  const handleCancel = React.useCallback(() => onSubmit(false), [onSubmit])
  const handleSubmit = React.useCallback(() => onSubmit(true), [onSubmit])
  return (
    <M.Dialog open={open} fullWidth maxWidth="sm">
      <M.DialogTitle>{title}</M.DialogTitle>
      <M.DialogContent>{children}</M.DialogContent>
      <M.DialogActions>
        <M.Button onClick={handleCancel} color="primary" variant="outlined">
          Cancel
        </M.Button>
        <M.Button color="primary" onClick={handleSubmit} variant="contained">
          Submit
        </M.Button>
      </M.DialogActions>
    </M.Dialog>
  )
}

interface PromptProps {
  onSubmit: (value: boolean) => void
  title: string
}

export function useConfirm({ title, onSubmit }: PromptProps) {
  const [key, setKey] = React.useState(0)
  const [opened, setOpened] = React.useState(false)
  const open = React.useCallback(() => {
    setKey(R.inc)
    setOpened(true)
  }, [])
  const close = React.useCallback(() => setOpened(false), [])
  const handleSubmit = React.useCallback(
    (value: boolean) => {
      onSubmit(value)
      close()
    },
    [close, onSubmit],
  )
  const render = React.useCallback(
    (children: React.ReactNode) => (
      <Dialog
        {...{
          children,
          key,
          onSubmit: handleSubmit,
          open: opened,
          title,
        }}
      />
    ),
    [key, handleSubmit, opened, title],
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
