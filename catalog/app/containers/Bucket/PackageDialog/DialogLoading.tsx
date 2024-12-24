import * as React from 'react'
import * as M from '@material-ui/core'

const useStyles = M.makeStyles({
  content: {
    paddingTop: 0,
  },
})

interface DialogLoadingProps {
  cancelText?: React.ReactNode
  onCancel: () => void
  skeletonElement: React.ReactNode
  submitText?: React.ReactNode
  title: React.ReactNode
}

export default function DialogLoading({
  cancelText,
  onCancel,
  skeletonElement,
  submitText,
  title,
}: DialogLoadingProps) {
  const classes = useStyles()
  return (
    <>
      <M.DialogTitle>{title}</M.DialogTitle>
      <M.DialogContent className={classes.content}>{skeletonElement}</M.DialogContent>
      <M.DialogActions>
        <M.Button onClick={onCancel}>{cancelText || 'Cancel'}</M.Button>
        <M.Button variant="contained" color="primary" disabled>
          {submitText || 'Push'}
        </M.Button>
      </M.DialogActions>
    </>
  )
}
