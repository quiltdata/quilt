import PT from 'prop-types'
import React from 'react'
import * as M from '@material-ui/core'

const useStyles = M.makeStyles((t) => ({
  close: {
    padding: t.spacing(0.5),
  },
}))

export default function Notification({ id, ttl, message, action, dismiss }) {
  const classes = useStyles()

  const handleClose = React.useCallback(() => dismiss(id), [dismiss, id])

  return (
    <M.Snackbar
      open
      message={message}
      autoHideDuration={ttl}
      onClose={handleClose}
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

Notification.propTypes = {
  id: PT.string.isRequired,
  ttl: PT.number.isRequired,
  message: PT.node.isRequired,
  action: PT.shape({
    label: PT.string.isRequired,
    onClick: PT.func.isRequired,
  }),
  dismiss: PT.func.isRequired,
}
