import PT from 'prop-types'
import React from 'react'
import { setPropTypes } from 'recompose'
import { makeStyles } from '@material-ui/styles'
import Button from '@material-ui/core/Button'
import Snackbar from '@material-ui/core/Snackbar'
import Icon from '@material-ui/core/Icon'
import IconButton from '@material-ui/core/IconButton'

import { composeComponent } from 'utils/reactTools'

const useStyles = makeStyles((t) => ({
  close: {
    padding: t.spacing.unit / 2,
  },
}))

export default composeComponent(
  'Notifications.Notification',
  setPropTypes({
    id: PT.string.isRequired,
    ttl: PT.number.isRequired,
    message: PT.node.isRequired,
    action: PT.shape({
      label: PT.string.isRequired,
      onClick: PT.func.isRequired,
    }),
    dismiss: PT.func.isRequired,
  }),
  ({ id, ttl, message, action, dismiss }) => {
    const classes = useStyles()

    const handleClose = React.useCallback(() => dismiss(id), [dismiss, id])

    return (
      <Snackbar
        open
        message={message}
        autoHideDuration={ttl}
        onClose={handleClose}
        action={
          <React.Fragment>
            {!!action && (
              <Button color="secondary" size="small" onClick={action.onClick}>
                {action.label}
              </Button>
            )}
            <IconButton
              aria-label="Close"
              color="inherit"
              className={classes.close}
              onClick={handleClose}
            >
              <Icon>close</Icon>
            </IconButton>
          </React.Fragment>
        }
      />
    )
  },
)
