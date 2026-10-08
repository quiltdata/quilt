import * as dateFns from 'date-fns'
import * as React from 'react'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import Code from 'components/Code'
import * as GQL from 'utils/GraphQL'
import assertNever from 'utils/assertNever'
import { shortenRevision } from 'utils/packageHandle'

import LOCK from './gql/PackageLock.generated'
import UNLOCK from './gql/PackageUnlock.generated'

export interface Lock {
  hash: string
  lockedAt: Date
  lockedBy: string
  reason: string | null
}

interface NoticeProps {
  lock: Lock
  onUnlock?: () => void
}

export function Notice({ lock, onUnlock }: NoticeProps) {
  return (
    <M.Box mt={1} mb={2}>
      <Lab.Alert
        // A standing page state, not an event: announce it politely.
        role="status"
        severity="info"
        icon={<M.Icon>lock</M.Icon>}
        action={
          onUnlock && (
            <M.Button color="inherit" size="small" onClick={onUnlock}>
              Unlock
            </M.Button>
          )
        }
      >
        <Lab.AlertTitle>Locked</Lab.AlertTitle>
        {lock.lockedBy} locked this package at revision{' '}
        <Code>{shortenRevision(lock.hash)}</Code> on{' '}
        {dateFns.format(lock.lockedAt, 'MMMM do yyyy')}. Quilt refuses new revisions and
        deletions until an admin unlocks it.
        {lock.reason && <M.Box mt={0.5}>Reason: {lock.reason}</M.Box>}
      </Lab.Alert>
    </M.Box>
  )
}

type Result =
  | { __typename: 'PackageLock' | 'Ok' }
  | { __typename: 'InvalidInput'; errors: readonly { message: string }[] }
  | { __typename: 'OperationError'; message: string; name: string }

function errorMessage(r: Result): string | null {
  switch (r.__typename) {
    case 'PackageLock':
    case 'Ok':
      return null
    case 'InvalidInput':
      return r.errors.map((e) => e.message).join('; ')
    case 'OperationError':
      return r.name === 'LatestMoved'
        ? 'A new revision was pushed since this dialog opened. Lock again to lock the new latest revision.'
        : r.message
    default:
      return assertNever(r)
  }
}

type DialogProps = {
  bucket: string
  name: string
  onClose: () => void
} & (
  | { action: 'lock'; hash: string; onLatestMoved?: () => void }
  | { action: 'unlock'; hash?: never; onLatestMoved?: never }
)

export function Dialog({
  bucket,
  name,
  action,
  hash,
  onClose,
  onLatestMoved,
}: DialogProps) {
  const lock = GQL.useMutation(LOCK)
  const unlock = GQL.useMutation(UNLOCK)
  const [reason, setReason] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)

  // A reply for a package the page no longer shows must not touch it or the page.
  const generation = React.useRef(0)
  React.useEffect(
    () => () => {
      generation.current += 1
    },
    [bucket, name],
  )

  const submit = React.useCallback(async () => {
    const gen = generation.current
    setLoading(true)
    setError(null)
    try {
      const r =
        action === 'lock'
          ? (await lock({ bucket, name, hash, reason: reason.trim() || null }))
              .packageLock
          : (await unlock({ bucket, name })).packageUnlock
      if (gen !== generation.current) return
      const msg = errorMessage(r)
      if (!msg) return onClose()
      if (r.__typename === 'OperationError' && r.name === 'LatestMoved') onLatestMoved?.()
      setError(msg)
    } catch (e: any) {
      if (gen !== generation.current) return
      setError(`Unexpected error: ${e.message ?? e}`)
    }
    setLoading(false)
  }, [bucket, name, action, hash, reason, lock, unlock, onClose, onLatestMoved])

  const verb = action === 'lock' ? 'Lock' : 'Unlock'
  return (
    <M.Dialog
      open
      onClose={loading ? undefined : onClose}
      aria-labelledby="lock-title"
      aria-describedby="lock-description"
    >
      <M.DialogTitle id="lock-title">
        {verb} package <Code>{name}</Code>?
      </M.DialogTitle>
      <M.DialogContent>
        <M.DialogContentText id="lock-description">
          {action === 'lock' ? (
            <>
              Freezes the package at its latest revision,{' '}
              <Code>{shortenRevision(hash)}</Code>. Quilt refuses new revisions and
              deletions until an admin unlocks it.
            </>
          ) : (
            'Anyone with write access can push and delete revisions again.'
          )}
        </M.DialogContentText>
        {action === 'lock' && (
          <M.TextField
            autoFocus
            disabled={loading}
            fullWidth
            id="package-lock-reason"
            label="Reason (optional)"
            onChange={(e) => setReason(e.target.value)}
            value={reason}
          />
        )}
        {error && (
          <M.Box mt={2}>
            <Lab.Alert severity="error">{error}</Lab.Alert>
          </M.Box>
        )}
      </M.DialogContent>
      <M.DialogActions>
        <M.Button onClick={onClose} disabled={loading}>
          Cancel
        </M.Button>
        <M.Button color="primary" onClick={submit} disabled={loading}>
          {verb}
        </M.Button>
      </M.DialogActions>
    </M.Dialog>
  )
}
