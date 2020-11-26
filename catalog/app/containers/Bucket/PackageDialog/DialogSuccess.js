import * as React from 'react'
import { Link } from 'react-router-dom'
import * as M from '@material-ui/core'

import * as NamedRoutes from 'utils/NamedRoutes'
import StyledLink from 'utils/StyledLink'

// TODO: use the same API as for DialogError and DialogLoading
export default function DialogSuccess({ bucket, name, revision, onClose }) {
  const { urls } = NamedRoutes.use()

  const packageUrl = urls.bucketPackageTree(bucket, name, revision)

  return (
    <div>
      <M.DialogTitle>Push complete</M.DialogTitle>
      <M.DialogContent style={{ paddingTop: 0 }}>
        <M.Typography>
          Package{' '}
          <StyledLink to={packageUrl}>
            {name}@{revision}
          </StyledLink>{' '}
          successfully created
        </M.Typography>
      </M.DialogContent>
      <M.DialogActions>
        <M.Button onClick={onClose}>Close</M.Button>
        <M.Button component={Link} to={packageUrl} variant="contained" color="primary">
          Browse package
        </M.Button>
      </M.DialogActions>
    </div>
  )
}
