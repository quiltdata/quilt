import * as React from 'react'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import Code from 'components/Code'
import * as packageHandleUtils from 'utils/packageHandle'

const useStyles = M.makeStyles((t) => ({
  danger: {
    color: t.palette.error.dark,
  },
  lock: {
    alignItems: 'center',
    background: 'rgba(255,255,255,0.7)',
    border: `1px solid ${t.palette.action.disabled}`,
    borderRadius: t.shape.borderRadius,
    bottom: 0,
    cursor: 'not-allowed',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  progressContainer: {
    display: 'flex',
    position: 'relative',
  },
}))

interface PackageDeleteDialogProps {
  error?: React.ReactNode
  loading: boolean
  onClose: () => void
  onDelete: (handle: packageHandleUtils.PackageHandle) => void
  open: boolean
  packageHandle: packageHandleUtils.PackageHandle
}

export default function PackageDeleteDialog({
  error,
  loading,
  onClose,
  onDelete,
  open,
  packageHandle,
}: PackageDeleteDialogProps) {
  const classes = useStyles()

  const onConfirm = React.useCallback(() => {
    onDelete(packageHandle)
  }, [packageHandle, onDelete])

  const onCancel = React.useCallback(() => {
    if (!loading) onClose()
  }, [loading, onClose])

  return (
    <M.Dialog
      aria-labelledby="alert-dialog-title"
      aria-describedby="alert-dialog-description"
      open={open}
      onClose={onCancel}
    >
      <M.DialogTitle id="alert-dialog-title">
        Really delete revision{' '}
        <Code>{packageHandleUtils.shortenRevision(packageHandle.hash)}</Code> of{' '}
        <Code>{packageHandle.name}</Code>?
      </M.DialogTitle>
      <M.DialogContent id="alert-dialog-description">
        <M.DialogContentText>
          This package revision will be lost forever. Package deletion does not delete
          objects in the package, but it does delete all metadata and all records of the
          contents of this revision. Are you sure you want to delete it?
        </M.DialogContentText>

        {!!error && <Lab.Alert severity="error">{error}</Lab.Alert>}
      </M.DialogContent>

      <M.DialogActions>
        <M.Button onClick={onCancel} color="primary" autoFocus disabled={loading}>
          Cancel
        </M.Button>
        <M.Button onClick={onConfirm} className={classes.danger} disabled={loading}>
          Yes, delete it
        </M.Button>
      </M.DialogActions>

      {loading && (
        <div className={classes.lock}>
          <div className={classes.progressContainer}>
            <M.CircularProgress size={80} variant="indeterminate" />
          </div>
        </div>
      )}
    </M.Dialog>
  )
}
