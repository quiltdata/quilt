import * as R from 'ramda'
import * as React from 'react'
import * as M from '@material-ui/core'
import { fade } from '@material-ui/core/styles'

import StyledLink from 'utils/StyledLink'
import { readableBytes } from 'utils/string'
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
    (e) => (
      <>
        <M.Typography variant="h6" gutterBottom>
          Invalid workflows config
        </M.Typography>
        <M.Typography gutterBottom>
          Error: <code>{e.message}</code>
        </M.Typography>
        <M.Typography>
          Please fix the workflows config according to{' '}
          <StyledLink href={`${docs}/advanced-usage/workflows`} target="_blank">
            the documentation
          </StyledLink>
          .
        </M.Typography>
      </>
    ),
    R.is(ERRORS.ManifestTooLarge),
    (e) => (
      <>
        <M.Typography variant="h6" gutterBottom>
          Package manifest too large
        </M.Typography>
        <M.Typography gutterBottom>
          This package is not editable via the web UI&mdash;it cannot handle package
          manifest that large ({readableBytes(e.actualSize)}).
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

export default function DialogError({ error, skeletonElement, title, onCancel }) {
  const classes = useStyles()

  return (
    <>
      <M.DialogTitle>{title}</M.DialogTitle>

      <M.DialogContent className={classes.content}>
        {skeletonElement}
        <div className={classes.overlay}>{errorDisplay(error)}</div>
      </M.DialogContent>

      <M.DialogActions>
        <M.Button onClick={onCancel}>Cancel</M.Button>
        <M.Button variant="contained" color="primary" disabled>
          Push
        </M.Button>
      </M.DialogActions>
    </>
  )
}
