import * as React from 'react'
import * as M from '@material-ui/core'

import Code from 'components/Code'
import * as packageHandleUtils from 'utils/packageHandle'

const useStyles = M.makeStyles((t) => ({
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

interface PackageRemoveDialogProps {
  onClose: () => void
  onRemove: (handle: packageHandleUtils.PackageHandle) => void
  open: boolean
  packageHandle: packageHandleUtils.PackageHandle
}

export default function PackageRemoveDialog({
  open,
  packageHandle,
  onClose,
  onRemove,
}: PackageRemoveDialogProps) {
  const classes = useStyles()
  const [removing, setRemoving] = React.useState(false)

  const handleRemove = React.useCallback(() => {
    setRemoving(true)
    onRemove(packageHandle)
  }, [packageHandle, onRemove])

  const handleClose = React.useCallback(() => {
    if (!removing) onClose()
  }, [removing, onClose])

  return (
    <M.Dialog
      aria-labelledby="alert-dialog-title"
      aria-describedby="alert-dialog-description"
      open={open}
      onClose={handleClose}
    >
      <M.DialogTitle id="alert-dialog-title">Confirm deletion</M.DialogTitle>
      <M.DialogContent id="alert-dialog-description">
        <M.DialogContentText>
          You are about to delete{' '}
          <Code>{packageHandleUtils.shortenRevision(packageHandle.revision)}</Code>{' '}
          revison of <Code>{packageHandle.name}</Code> package.
        </M.DialogContentText>
        <M.DialogContentText>
          This action is non-reversible! Are you sure?
        </M.DialogContentText>
      </M.DialogContent>
      <M.DialogActions>
        <M.Button onClick={handleClose} color="primary" autoFocus disabled={removing}>
          Cancel
        </M.Button>
        <M.Button onClick={handleRemove} color="primary" disabled={removing}>
          Yes, delete
        </M.Button>
      </M.DialogActions>
      {removing && (
        <div className={classes.lock}>
          <div className={classes.progressContainer}>
            <M.CircularProgress size={80} variant="indeterminate" />
          </div>
        </div>
      )}
    </M.Dialog>
  )
}
