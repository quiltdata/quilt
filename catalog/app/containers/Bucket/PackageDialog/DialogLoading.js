import * as React from 'react'
import * as M from '@material-ui/core'

const dialogContentStyles = {
  paddingTop: 0,
}

export default function DialogLoading({ skeletonElement, title, onCancel }) {
  return (
    <div>
      <M.DialogTitle>{title}</M.DialogTitle>

      <M.DialogContent style={dialogContentStyles}>{skeletonElement}</M.DialogContent>

      <M.DialogActions>
        <M.Button onClick={onCancel}>Cancel</M.Button>
        <M.Button variant="contained" color="primary" disabled>
          Push
        </M.Button>
      </M.DialogActions>
    </div>
  )
}
