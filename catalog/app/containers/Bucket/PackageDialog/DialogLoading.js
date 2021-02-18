import * as React from 'react'
import * as M from '@material-ui/core'

const useStyles = M.makeStyles(() => ({
  content: {
    height: 430,
    paddingTop: 0,
  },
}))

export default function DialogLoading({ skeletonElement, title, onCancel }) {
  const classes = useStyles()

  return (
    <div>
      <M.DialogTitle>{title}</M.DialogTitle>

      <M.DialogContent className={classes.content}>{skeletonElement}</M.DialogContent>

      <M.DialogActions>
        <M.Button onClick={onCancel}>Cancel</M.Button>
        <M.Button variant="contained" color="primary" disabled>
          Push
        </M.Button>
      </M.DialogActions>
    </div>
  )
}
