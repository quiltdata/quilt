import * as React from 'react'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import Code from 'components/Code'
import * as Format from 'utils/format'
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

export type DeleteScope =
  | { type: 'revision'; hash: string }
  | { type: 'revisions'; count: number }
  | { type: 'package' }

interface PackageDeleteDialogProps {
  error?: React.ReactNode
  loading: boolean
  name: string
  onClose: () => void
  onDelete: () => void
  open: boolean
  scope: DeleteScope
}

function Title({ name, scope }: { name: string; scope: DeleteScope }) {
  switch (scope.type) {
    case 'package':
      return (
        <>
          Really delete package <Code>{name}</Code> and all of its revisions?
        </>
      )
    case 'revisions':
      return (
        <>
          Really delete {scope.count}{' '}
          <Format.Plural value={scope.count} one="revision" other="revisions" /> of{' '}
          <Code>{name}</Code>?
        </>
      )
    case 'revision':
      return (
        <>
          Really delete revision{' '}
          <Code>{packageHandleUtils.shortenRevision(scope.hash)}</Code> of{' '}
          <Code>{name}</Code>?
        </>
      )
  }
}

const LOST = {
  package: 'Every revision of this package will be lost forever.',
  revisions: 'These package revisions will be lost forever.',
  revision: 'This package revision will be lost forever.',
}

const RECORDS = {
  package: '',
  revisions: ' of these revisions',
  revision: ' of this revision',
}

// A one-revision selection reads as a single revision, not "1 revisions".
const textKey = (scope: DeleteScope) =>
  scope.type === 'revisions' && scope.count === 1 ? 'revision' : scope.type

export default function PackageDeleteDialog({
  error,
  loading,
  name,
  onClose,
  onDelete,
  open,
  scope,
}: PackageDeleteDialogProps) {
  const classes = useStyles()

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
        <Title name={name} scope={scope} />
      </M.DialogTitle>
      <M.DialogContent id="alert-dialog-description">
        <M.DialogContentText>
          {LOST[textKey(scope)]} Package deletion does not delete objects in the package,
          but it does delete all metadata and all records of the contents
          {RECORDS[textKey(scope)]}. Are you sure you want to delete it?
        </M.DialogContentText>

        {!!error && <Lab.Alert severity="error">{error}</Lab.Alert>}
      </M.DialogContent>

      <M.DialogActions>
        <M.Button onClick={onCancel} color="primary" autoFocus disabled={loading}>
          Cancel
        </M.Button>
        <M.Button onClick={onDelete} className={classes.danger} disabled={loading}>
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
