import React from 'react'
import * as M from '@material-ui/core'

const useStyles = M.makeStyles((t) => ({
  close: {
    padding: t.spacing(0.5),
  },
}))

interface NotificationProps {
  id: string
  ttl?: number | null
  message: React.ReactNode
  action: {
    onClick: () => void
    label: React.ReactNode
  }
  dismiss: (id: string) => void
}

export default function Notification({
  id,
  ttl,
  message,
  action,
  dismiss,
}: NotificationProps) {
  const classes = useStyles()

  const handleClose = React.useCallback(() => dismiss(id), [dismiss, id])

  return (
    <M.Snackbar
      open
      message={message}
      autoHideDuration={ttl}
      onClose={handleClose}
      data-testid="notification"
      action={
        <>
          {!!action && (
            <M.Button color="secondary" size="small" onClick={action.onClick}>
              {action.label}
            </M.Button>
          )}
          <M.IconButton
            aria-label="Close"
            color="inherit"
            className={classes.close}
            onClick={handleClose}
          >
            <M.Icon>close</M.Icon>
          </M.IconButton>
        </>
      }
    />
  )
}
