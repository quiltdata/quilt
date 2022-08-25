import * as React from 'react'
import * as M from '@material-ui/core'

interface DialogProps {
  onCancel: () => void
  onSubmit: (value: string) => void
  open: boolean
  title: string
}

// TODO: default value
function Dialog({ open, onCancel, onSubmit, title }: DialogProps) {
  const [value, setValue] = React.useState('')
  return (
    <M.Dialog open={open}>
      <M.DialogTitle>{title}</M.DialogTitle>
      <M.DialogContent>
        <M.TextField
          autoFocus
          fullWidth
          margin="dense"
          onChange={(e) => setValue(e.target.value)}
          value={value}
        />
      </M.DialogContent>
      <M.DialogActions>
        <M.Button onClick={onCancel} color="primary" variant="outlined">
          Cancel
        </M.Button>
        <M.Button onClick={() => onSubmit(value)} color="primary" variant="contained">
          Submit
        </M.Button>
      </M.DialogActions>
    </M.Dialog>
  )
}

interface PromptProps {
  title: string
  onSubmit: (value: string) => void
}
export function usePrompt({ title, onSubmit }: PromptProps) {
  const [opened, setOpened] = React.useState(false)
  const open = React.useCallback(() => setOpened(true), [])
  const close = React.useCallback(() => setOpened(false), [])
  const render = React.useCallback(
    () => <Dialog title={title} open={opened} onCancel={close} onSubmit={onSubmit} />,
    [close, opened, onSubmit, title],
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
