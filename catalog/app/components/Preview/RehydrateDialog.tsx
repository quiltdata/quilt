import * as React from 'react'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import * as URLS from 'constants/urls'
import Log from 'utils/Logging'
import StyledLink from 'utils/StyledLink'
import assertNever from 'utils/assertNever'
import type { RetrievalTier, StorageClass } from 'utils/glacier'
import type * as Model from 'model'

import { useRestoreObject } from './restoreObject'
import type { RestoreResult } from './restoreObject'

const MIN_DAYS = 1
const MAX_DAYS = 90
const DEFAULT_DAYS = 7
const DEFAULT_TIER: RetrievalTier = 'Standard'

const S3_RESTORE_DOC =
  'https://docs.aws.amazon.com/AmazonS3/latest/userguide/restoring-objects.html'

// Quilt docs explaining the IAM permissions an admin grants per bucket — where a
// user blocked on s3:RestoreObject learns what to ask their admin to enable.
const REHYDRATE_PERMISSION_DOC = `${URLS.docs}/quilt-platform-administrator/advanced/s3-prefix-permissions`

interface TierOption {
  value: RetrievalTier
  label: string
  hint: string
}

const TIER_OPTIONS: TierOption[] = [
  {
    value: 'Standard',
    label: 'Standard',
    hint: 'Minutes to hours (GLACIER) / up to 12 hours (DEEP_ARCHIVE).',
  },
  {
    value: 'Bulk',
    label: 'Bulk',
    hint: 'Up to 12 hours (GLACIER) / up to 48 hours (DEEP_ARCHIVE). Lowest cost.',
  },
  {
    value: 'Expedited',
    label: 'Expedited',
    hint: '1–5 minutes (GLACIER only). Most expensive; may be unavailable.',
  },
]

interface Failure {
  message: string
  // Show the "ask your admin for s3:RestoreObject" hint under the error.
  iam?: boolean
}

// The submit lifecycle. `failed` carries the message to show; otherwise the
// dialog is idle (editing) or submitting. Replaces the separate submitting /
// errorMessage / showIamHint flags.
type Status = { _tag: 'idle' } | { _tag: 'submitting' } | ({ _tag: 'failed' } & Failure)

const IDLE: Status = { _tag: 'idle' }

// What a completed mutation means for the dialog: close it (optionally flipping
// the parent to "Restore in progress"), or stay open showing a failure.
type Outcome = { _tag: 'close'; flip: boolean } | ({ _tag: 'failed' } & Failure)

// Pure mapping from the mutation union to a dialog outcome. Kept separate from
// the imperative submit so it can be reasoned about / tested on its own.
export function interpretResult(r: RestoreResult): Outcome {
  switch (r.__typename) {
    case 'RestoreObjectSuccess':
      // 202 (alreadyRestored=false): flip the parent to "Restore in progress".
      // 200 (alreadyRestored=true): a rare stale-cache race — close silently; a
      // later page load re-reads the HEAD and leaves "Object Archived".
      return { _tag: 'close', flip: !r.alreadyRestored }
    case 'OperationError':
      switch (r.name) {
        case 'RestoreAlreadyInProgress':
          // Already running → same in-progress flip as a fresh 202.
          return { _tag: 'close', flip: true }
        case 'GlacierExpeditedUnavailable':
          return {
            _tag: 'failed',
            message: 'Expedited capacity unavailable. Try Standard or Bulk.',
          }
        case 'RestoreAccessDenied':
          return {
            _tag: 'failed',
            message: "You don't have permission to rehydrate this object.",
            iam: true,
          }
        case 'InvalidObjectState':
          // Expected condition (object already restored / not archived).
          return {
            _tag: 'failed',
            message:
              'This object is not archived — it may already be restored. No rehydration needed.',
          }
        case 'ObjectNotFound':
          return {
            _tag: 'failed',
            message: 'This object no longer exists — it may have been deleted.',
          }
        case 'BucketNotFound':
          return {
            _tag: 'failed',
            message: 'This bucket no longer exists or is not accessible.',
          }
        default:
          Log.error(new Error(`restoreObject: ${r.name}: ${r.message}`))
          return {
            _tag: 'failed',
            message: r.message || 'Failed to start restore. Please try again later.',
          }
      }
    case 'InvalidInput':
      return { _tag: 'failed', message: r.errors[0]?.message || 'Invalid input' }
    default:
      return assertNever(r)
  }
}

const useStyles = M.makeStyles((t) => ({
  row: {
    alignItems: 'flex-start',
    display: 'flex',
    gap: t.spacing(2),
    marginTop: t.spacing(1),
  },
  tierField: {
    flex: 1,
  },
  daysField: {
    flex: 1,
  },
  permissionHint: {
    marginTop: t.spacing(2),
  },
  docLink: {
    display: 'block',
    marginTop: t.spacing(2),
  },
}))

interface RehydrateFormProps {
  handle: Model.S3.S3ObjectLocation
  storageClass?: StorageClass
  onClose: () => void
  onSubmitted: () => void
}

// The form body. Mounted only while the dialog is open (M.Dialog unmounts its
// children on close), so its state starts fresh on every open — no manual reset.
function RehydrateForm({
  handle,
  storageClass,
  onClose,
  onSubmitted,
}: RehydrateFormProps) {
  const classes = useStyles()
  const restoreObject = useRestoreObject()

  const [tier, setTier] = React.useState<RetrievalTier>(DEFAULT_TIER)
  const [daysInput, setDaysInput] = React.useState<string>(String(DEFAULT_DAYS))
  const [status, setStatus] = React.useState<Status>(IDLE)

  const submitting = status._tag === 'submitting'

  // A 202 makes the parent drop the dialog outright (no close transition), and a
  // close mid-submit unmounts the form once the request settles. Guard the one
  // post-await setState so it doesn't fire on an unmounted component.
  const mountedRef = React.useRef(true)
  React.useEffect(
    () => () => {
      mountedRef.current = false
    },
    [],
  )

  const parsedDays = React.useMemo(() => {
    if (daysInput.trim() === '') return NaN
    const n = Number(daysInput)
    return Number.isFinite(n) ? n : NaN
  }, [daysInput])

  const daysValid =
    Number.isFinite(parsedDays) &&
    Number.isInteger(parsedDays) &&
    parsedDays >= MIN_DAYS &&
    parsedDays <= MAX_DAYS

  const handleDaysChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setDaysInput(e.target.value)
  }, [])

  const handleTierChange = React.useCallback(
    (e: React.ChangeEvent<{ value: unknown }>) => {
      setTier(e.target.value as RetrievalTier)
    },
    [],
  )

  // Expedited is GLACIER-only; offer it only when the class is known to be
  // GLACIER, so an unknown class (edge loader paths) fails safe to no Expedited.
  const tierOptions = React.useMemo(
    () =>
      storageClass === 'GLACIER'
        ? TIER_OPTIONS
        : TIER_OPTIONS.filter((o) => o.value !== 'Expedited'),
    [storageClass],
  )

  const tierHint = React.useMemo(
    () => tierOptions.find((o) => o.value === tier)?.hint,
    [tierOptions, tier],
  )

  const handleSubmit = React.useCallback(async () => {
    if (!daysValid || submitting) return
    setStatus({ _tag: 'submitting' })
    let outcome: Outcome
    try {
      outcome = interpretResult(await restoreObject({ handle, tier, days: parsedDays }))
    } catch (e) {
      // Transport/network failure (the mutation itself rejected).
      Log.error(e)
      outcome = {
        _tag: 'failed',
        message:
          (e instanceof Error && e.message) ||
          'Failed to start restore. Please try again later.',
      }
    }
    if (!mountedRef.current) return
    if (outcome._tag === 'close') {
      if (outcome.flip) onSubmitted()
      onClose()
    } else {
      setStatus(outcome)
    }
  }, [
    daysValid,
    submitting,
    restoreObject,
    handle,
    tier,
    parsedDays,
    onSubmitted,
    onClose,
  ])

  return (
    <>
      <M.DialogTitle>Rehydrate from Glacier</M.DialogTitle>
      <M.DialogContent>
        <M.Typography variant="body2" gutterBottom>
          Rehydrating makes this archived object temporarily downloadable. It stays
          available for the number of days you choose, then returns to archived — the
          object itself is never lost.
        </M.Typography>

        <div className={classes.row}>
          <M.TextField
            select
            id="rehydrate-tier"
            className={classes.tierField}
            label="Retrieval tier"
            value={tier}
            onChange={handleTierChange}
            SelectProps={{ native: true }}
            inputProps={{ 'aria-label': 'Retrieval tier' }}
            helperText={tierHint}
          >
            {tierOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </M.TextField>

          <M.TextField
            id="rehydrate-days"
            className={classes.daysField}
            label="Duration (days)"
            type="number"
            value={daysInput}
            onChange={handleDaysChange}
            inputProps={{
              min: MIN_DAYS,
              max: MAX_DAYS,
              step: 1,
              'aria-label': 'Restore duration in days',
            }}
            error={!daysValid}
            helperText={
              !daysValid
                ? `Enter a value between ${MIN_DAYS} and ${MAX_DAYS}.`
                : `How long the restored copy stays downloadable (${MIN_DAYS}–${MAX_DAYS}).`
            }
          />
        </div>

        {status._tag === 'failed' && (
          <Lab.Alert severity="error" className={classes.permissionHint}>
            {status.message}
            {status.iam && (
              <M.Typography variant="body2">
                Your IAM role needs <code>s3:RestoreObject</code> on this bucket.{' '}
                <StyledLink href={REHYDRATE_PERMISSION_DOC} target="_blank">
                  Ask your admin to enable rehydration
                </StyledLink>
                .
              </M.Typography>
            )}
          </Lab.Alert>
        )}

        <StyledLink href={S3_RESTORE_DOC} target="_blank" className={classes.docLink}>
          Learn more about S3 Glacier retrieval tiers
        </StyledLink>
      </M.DialogContent>
      <M.DialogActions>
        <M.Button onClick={onClose} disabled={submitting} color="primary">
          Cancel
        </M.Button>
        <M.Button
          onClick={handleSubmit}
          disabled={!daysValid || submitting}
          color="primary"
          variant="contained"
        >
          {submitting ? 'Submitting…' : 'Rehydrate'}
        </M.Button>
      </M.DialogActions>
    </>
  )
}

interface RehydrateDialogProps {
  open: boolean
  onClose: () => void
  handle: Model.S3.S3ObjectLocation
  storageClass?: StorageClass
  onSubmitted: () => void
}

export default function RehydrateDialog({
  open,
  onClose,
  handle,
  storageClass,
  onSubmitted,
}: RehydrateDialogProps) {
  return (
    <M.Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <RehydrateForm
        handle={handle}
        storageClass={storageClass}
        onClose={onClose}
        onSubmitted={onSubmitted}
      />
    </M.Dialog>
  )
}
