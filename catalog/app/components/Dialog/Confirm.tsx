import * as R from 'ramda'
import * as React from 'react'
import * as M from '@material-ui/core'

interface DialogProps {
  cancelTitle?: string
  children: React.ReactNode
  onSubmit: (value: boolean) => Promise<void>
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
  const [submitting, setSubmitting] = React.useState(false)

  const handleCancel = React.useCallback(async () => {
    if (!submitting) {
      await onSubmit(false)
    }
  }, [onSubmit, submitting])

  const handleSubmit = React.useCallback(async () => {
    setSubmitting(true)
    try {
      await onSubmit(true)
    } finally {
      setSubmitting(false)
    }
  }, [onSubmit])
  return (
    <M.Dialog open={open} fullWidth maxWidth="sm">
      <M.DialogTitle>{title}</M.DialogTitle>
      <M.DialogContent>{children}</M.DialogContent>
      <M.DialogActions>
        <M.Button onClick={handleCancel} color="primary" variant="outlined">
          {cancelTitle}
        </M.Button>
        <M.Button
          color="primary"
          disabled={submitting}
          onClick={handleSubmit}
          variant="contained"
        >
          {submitting ? (
            <>
              <M.CircularProgress size={16} style={{ marginRight: 8 }} />
              Processing...
            </>
          ) : (
            submitTitle
          )}
        </M.Button>
      </M.DialogActions>
    </M.Dialog>
  )
}

interface PromptProps {
  cancelTitle?: string
  onSubmit: (value: boolean) => Promise<void>
  submitTitle?: string
  title: string
}

// TODO: Re-use utils/Dialog
export function useConfirm({ cancelTitle, title, onSubmit, submitTitle }: PromptProps) {
  const [key, setKey] = React.useState(0)
  const [opened, setOpened] = React.useState(false)
  const open = React.useCallback(() => {
    setKey(R.inc)
    setOpened(true)
  }, [])
  const close = React.useCallback(() => {
    setOpened(false)
  }, [])
  const handleSubmit = React.useCallback(
    async (value: boolean) => {
      await onSubmit(value)
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
    [cancelTitle, key, handleSubmit, opened, title, submitTitle],
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
