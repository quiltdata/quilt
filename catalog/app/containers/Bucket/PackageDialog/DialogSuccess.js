import * as R from 'ramda'
import * as React from 'react'
import { Link } from 'react-router-dom'
import * as M from '@material-ui/core'

import * as NamedRoutes from 'utils/NamedRoutes'
import StyledLink from 'utils/StyledLink'

// TODO: use the same API as for DialogError and DialogLoading
export default function DialogSuccess({ bucket, hash, name, onClose }) {
  const { urls } = NamedRoutes.use()

  const bucketUrl = urls.bucketOverview(bucket)
  const packageUrl = urls.bucketPackageTree(bucket, name, hash)

  return (
    <div>
      <M.DialogTitle>Push complete</M.DialogTitle>
      <M.DialogContent style={{ paddingTop: 0 }}>
        <M.Typography>
          Pushed to <StyledLink to={bucketUrl}>s3://{bucket}</StyledLink> as{' '}
          <StyledLink to={packageUrl}>
            {name}@{R.take(10, hash)}
          </StyledLink>{' '}
        </M.Typography>
      </M.DialogContent>
      <M.DialogActions>
        <M.Button onClick={onClose}>Close</M.Button>
        <M.Button
          onClick={onClose}
          component={Link}
          to={packageUrl}
          variant="contained"
          color="primary"
        >
          Browse package
        </M.Button>
      </M.DialogActions>
    </div>
  )
}
