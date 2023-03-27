import * as R from 'ramda'
import * as React from 'react'
import * as M from '@material-ui/core'

interface DialogProps {
  cancelTitle?: string
  children: React.ReactNode
  onSubmit: (value: boolean) => void
  open: boolean
  submitTitle?: string
  title: string
}

function Dialog({
  children,
  onSubmit,
  open,
  cancelTitle = 'Cancel',
  submitTitle = 'Submit',
  title,
}: DialogProps) {
  const handleCancel = React.useCallback(() => onSubmit(false), [onSubmit])
  const handleSubmit = React.useCallback(() => onSubmit(true), [onSubmit])
  return (
    <M.Dialog open={open} fullWidth maxWidth="sm">
      <M.DialogTitle>{title}</M.DialogTitle>
      <M.DialogContent>{children}</M.DialogContent>
      <M.DialogActions>
        <M.Button onClick={handleCancel} color="primary" variant="outlined">
          {cancelTitle}
        </M.Button>
        <M.Button color="primary" onClick={handleSubmit} variant="contained">
          {submitTitle}
        </M.Button>
      </M.DialogActions>
    </M.Dialog>
  )
}

interface PromptProps {
  cancelTitle?: string
  onSubmit: (value: boolean) => void
  submitTitle?: string
  title: string
}

export function useConfirm({ cancelTitle, title, onSubmit, submitTitle }: PromptProps) {
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
          cancelTitle,
          children,
          key,
          onSubmit: handleSubmit,
          open: opened,
          submitTitle,
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
