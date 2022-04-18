import * as R from 'ramda'
import * as React from 'react'
import * as M from '@material-ui/core'
import { fade } from '@material-ui/core/styles'

import StyledLink from 'utils/StyledLink'
import { docs } from 'constants/urls'

import * as ERRORS from '../errors'

const useStyles = M.makeStyles((t) => ({
  content: {
    paddingTop: 0,
    position: 'relative',
  },
  overlay: {
    background: fade(t.palette.common.white, 0.4),
    bottom: 0,
    display: 'flex',
    flexDirection: 'column',
    left: 0,
    padding: t.spacing(2, 3, 4),
    position: 'absolute',
    right: 0,
    top: 0,
  },
}))

const errorDisplay = R.cond([
  [
    R.is(ERRORS.WorkflowsConfigInvalid),
    (e: ERRORS.WorkflowsConfigInvalid) => (
      <>
        <M.Typography variant="h6" gutterBottom>
          Invalid workflows config
        </M.Typography>
        <M.Typography gutterBottom>
          Error: <code>{e.message}</code>
        </M.Typography>
        <M.Typography>
          Please fix the workflows config according to{' '}
          <StyledLink href={`${docs}/advanced/workflows`} target="_blank">
            the documentation
          </StyledLink>
          .
        </M.Typography>
      </>
    ),
  ],
  [
    R.is(ERRORS.ManifestTooLarge),
    (e: ERRORS.ManifestTooLarge) => (
      <>
        <M.Typography variant="h6" gutterBottom>
          Package manifest too large
        </M.Typography>
        <M.Typography gutterBottom>
          This package is not editable via the web UI&mdash;it cannot handle package
          manifests with more than {e.max} entries.
        </M.Typography>
        <M.Typography>Please use Quilt CLI to edit this package.</M.Typography>
      </>
    ),
  ],
  [
    R.T,
    () => (
      <>
        <M.Typography variant="h6" gutterBottom>
          Unexpected error
        </M.Typography>
        <M.Typography gutterBottom>
          Something went wrong. Please contact Quilt support.
        </M.Typography>
        <M.Typography>You can also use Quilt CLI to edit this package.</M.Typography>
      </>
    ),
  ],
])

interface DialogErrorProps {
  cancelText?: React.ReactNode
  error: any
  onCancel: () => void
  skeletonElement: React.ReactNode
  submitText?: React.ReactNode
  title: React.ReactNode
}

export default function DialogError({
  cancelText,
  error,
  onCancel,
  skeletonElement,
  submitText,
  title,
}: DialogErrorProps) {
  const classes = useStyles()
  return (
    <>
      <M.DialogTitle>{title}</M.DialogTitle>
      <M.DialogContent className={classes.content}>
        {skeletonElement}
        <div className={classes.overlay}>{errorDisplay(error)}</div>
      </M.DialogContent>
      <M.DialogActions>
        <M.Button onClick={onCancel}>{cancelText || 'Cancel'}</M.Button>
        <M.Button variant="contained" color="primary" disabled>
          {submitText || 'Push'}
        </M.Button>
      </M.DialogActions>
    </>
  )
}
