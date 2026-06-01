import * as React from 'react'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import type { S3 } from 'aws-sdk'

import * as URLS from 'constants/urls'
import Log from 'utils/Logging'
import StyledLink from 'utils/StyledLink'
import assertNever from 'utils/assertNever'
import { GlacierTier } from 'utils/glacier'
import type * as Model from 'model'

import { useRestoreObject } from './restoreObject'

const MIN_DAYS = 1
const MAX_DAYS = 90
const DEFAULT_DAYS = 7
const DEFAULT_TIER: GlacierTier = 'Standard'

const S3_RESTORE_DOC =
  'https://docs.aws.amazon.com/AmazonS3/latest/userguide/restoring-objects.html'

// Quilt docs explaining the IAM permissions an admin grants per bucket — where a
// user blocked on s3:RestoreObject learns what to ask their admin to enable.
const REHYDRATE_PERMISSION_DOC = `${URLS.docs}/advanced/s3-prefix-permissions`

interface TierOption {
  value: GlacierTier
  label: string
  hint: string
}

const TIER_OPTIONS: TierOption[] = [
  {
    value: 'Standard',
    label: 'Standard',
    hint: 'Minutes to hours (GLACIER) / up to 12 hours (DEEP_ARCHIVE). Default.',
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

interface RehydrateDialogProps {
  open: boolean
  onClose: () => void
  handle: Model.S3.S3ObjectLocation
  storageClass?: S3.StorageClass
  onSubmitted: (alreadyRestored: boolean) => void
}

export default function RehydrateDialog({
  open,
  onClose,
  handle,
  storageClass,
  onSubmitted,
}: RehydrateDialogProps) {
  const classes = useStyles()
  const restoreObject = useRestoreObject()

  const [tier, setTier] = React.useState<GlacierTier>(DEFAULT_TIER)
  const [daysInput, setDaysInput] = React.useState<string>(String(DEFAULT_DAYS))
  const [submitting, setSubmitting] = React.useState(false)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)
  const [showIamHint, setShowIamHint] = React.useState(false)

  // A successful submit calls onSubmitted, which unmounts this dialog (the parent
  // switches to "Restore in progress"). Track mounted state so the post-await
  // updates below don't fire on an unmounted component.
  const mountedRef = React.useRef(true)
  React.useEffect(
    () => () => {
      mountedRef.current = false
    },
    [],
  )

  // Reset state when the dialog opens.
  React.useEffect(() => {
    if (open) {
      setTier(DEFAULT_TIER)
      setDaysInput(String(DEFAULT_DAYS))
      setSubmitting(false)
      setErrorMessage(null)
      setShowIamHint(false)
    }
  }, [open])

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
      setTier(e.target.value as GlacierTier)
    },
    [],
  )

  // Expedited is GLACIER-only (not DEEP_ARCHIVE); hide it for Deep Archive.
  const tierOptions = React.useMemo(
    () =>
      storageClass === 'DEEP_ARCHIVE'
        ? TIER_OPTIONS.filter((o) => o.value !== 'Expedited')
        : TIER_OPTIONS,
    [storageClass],
  )

  const tierHint = React.useMemo(
    () => tierOptions.find((o) => o.value === tier)?.hint,
    [tierOptions, tier],
  )

  const handleSubmit = React.useCallback(async () => {
    if (!daysValid || submitting) return
    setSubmitting(true)
    setErrorMessage(null)
    setShowIamHint(false)
    try {
      const r = await restoreObject({ handle, tier, days: parsedDays })
      if (!mountedRef.current) return
      switch (r.__typename) {
        case 'RestoreObjectSuccess':
          // 202 (alreadyRestored=false): onSubmitted(false) flips ArchivedMessage
          // to "Restore in progress" optimistically — that's the feedback.
          // DEV NOTE: 200 (alreadyRestored=true) intentionally has NO feedback —
          // the dialog just closes and the page stays on "Object Archived" until
          // reloaded. This only happens on a rare stale-cache race (the object's
          // restore completed since the cached HEAD was read; you can only open
          // this dialog from a "cold archived" view). We accept the silent close
          // rather than depend on the Notifications container. Revisit if/when
          // status is read fresh (e.g. via GraphQL) instead of a cached HEAD.
          onSubmitted(r.alreadyRestored)
          onClose()
          break
        case 'OperationError':
          switch (r.name) {
            case 'RestoreAlreadyInProgress':
              // Already running → flip ArchivedMessage to "Restore in progress"
              // (same as a fresh 202) instead of leaving the Rehydrate button.
              onSubmitted(false)
              onClose()
              break
            case 'GlacierExpeditedUnavailable':
              setErrorMessage('Expedited capacity unavailable. Try Standard or Bulk.')
              break
            case 'RestoreAccessDenied':
              setErrorMessage("You don't have permission to rehydrate this object.")
              setShowIamHint(true)
              break
            case 'InvalidObjectState':
              // Expected condition (object already restored / not archived),
              // not a failure — calm message, no Sentry.
              setErrorMessage(
                'This object is not archived — it may already be restored. No rehydration needed.',
              )
              break
            case 'ObjectNotFound':
              setErrorMessage('This object no longer exists — it may have been deleted.')
              break
            default:
              Log.error(new Error(`restoreObject: ${r.name}: ${r.message}`))
              setErrorMessage(
                r.message || 'Failed to start restore. Please try again later.',
              )
          }
          break
        case 'InvalidInput':
          setErrorMessage(r.errors[0]?.message || 'Invalid input')
          break
        default:
          assertNever(r)
      }
    } catch (e) {
      // Transport/network failure (the mutation itself rejected).
      Log.error(e)
      if (mountedRef.current) {
        setErrorMessage(
          (e instanceof Error && e.message) ||
            'Failed to start restore. Please try again later.',
        )
      }
    } finally {
      if (mountedRef.current) setSubmitting(false)
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
    <M.Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
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

        {errorMessage && (
          <Lab.Alert severity="error" className={classes.permissionHint}>
            {errorMessage}
            {showIamHint && (
              <>
                <br />
                Your IAM role needs <code>s3:RestoreObject</code> on this bucket.{' '}
                <StyledLink href={REHYDRATE_PERMISSION_DOC} target="_blank">
                  Ask your admin to enable rehydration
                </StyledLink>
                .
              </>
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
    </M.Dialog>
  )
}
