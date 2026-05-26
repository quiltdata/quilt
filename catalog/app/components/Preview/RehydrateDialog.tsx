import * as React from 'react'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import * as Notifications from 'containers/Notifications'
import * as AWS from 'utils/AWS'
import Log from 'utils/Logging'
import StyledLink from 'utils/StyledLink'
import type * as Model from 'model'

import * as requests from 'containers/Bucket/requests'

const MIN_DAYS = 1
const MAX_DAYS = 90
const DEFAULT_DAYS = 7
const DEFAULT_TIER: requests.GlacierTier = 'Standard'

const S3_RESTORE_DOC =
  'https://docs.aws.amazon.com/AmazonS3/latest/userguide/restoring-objects.html'

interface TierOption {
  value: requests.GlacierTier
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
  daysField: {
    marginTop: t.spacing(2),
    maxWidth: 240,
  },
  hint: {
    color: t.palette.text.secondary,
    display: 'block',
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
  onSubmitted: (alreadyRestored: boolean) => void
}

export default function RehydrateDialog({
  open,
  onClose,
  handle,
  onSubmitted,
}: RehydrateDialogProps) {
  const classes = useStyles()
  const s3 = AWS.S3.use()
  const { push } = Notifications.use()

  const [tier, setTier] = React.useState<requests.GlacierTier>(DEFAULT_TIER)
  const [daysInput, setDaysInput] = React.useState<string>(String(DEFAULT_DAYS))
  const [submitting, setSubmitting] = React.useState(false)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)
  const [showIamHint, setShowIamHint] = React.useState(false)

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
    const raw = e.target.value
    if (raw === '') {
      setDaysInput('')
      return
    }
    const n = Number(raw)
    if (!Number.isFinite(n)) {
      setDaysInput(raw)
      return
    }
    // Clamp typed values into [MIN_DAYS, MAX_DAYS].
    const clamped = Math.max(MIN_DAYS, Math.min(MAX_DAYS, Math.floor(n)))
    setDaysInput(String(clamped))
  }, [])

  const handleTierChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setTier(e.target.value as requests.GlacierTier)
  }, [])

  const handleSubmit = React.useCallback(async () => {
    if (!daysValid || submitting) return
    setSubmitting(true)
    setErrorMessage(null)
    setShowIamHint(false)
    try {
      const result = await requests.restoreObject({
        s3,
        handle,
        tier,
        days: parsedDays,
      })
      if (result.alreadyRestored) {
        push(`Already restored — duration extended to ${parsedDays} days`)
      } else {
        push('Restore initiated — check back later')
      }
      onSubmitted(result.alreadyRestored)
      onClose()
    } catch (e) {
      if (e instanceof requests.RestoreAlreadyInProgressError) {
        push(e.message)
        onClose()
      } else if (e instanceof requests.GlacierExpeditedUnavailableError) {
        setErrorMessage(e.message)
      } else if (e instanceof requests.RestoreAccessDeniedError) {
        setErrorMessage(e.message)
        setShowIamHint(true)
      } else {
        Log.error(e)
        // Prefer the AWS-shaped message when present (e.g. "AccessDenied:
        // ...") so the user sees what S3 actually returned, not a generic
        // toast that drops the real cause.
        const fallback =
          (e instanceof Error && e.message) ||
          'Failed to start restore. Please try again later.'
        setErrorMessage(fallback)
      }
    } finally {
      setSubmitting(false)
    }
  }, [daysValid, submitting, s3, handle, tier, parsedDays, push, onSubmitted, onClose])

  return (
    <M.Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <M.DialogTitle>Rehydrate from Glacier</M.DialogTitle>
      <M.DialogContent>
        <M.Typography variant="body2" gutterBottom>
          Restoring creates a temporary copy of this object that you can preview and
          download until it expires.
        </M.Typography>

        <M.FormControl component="fieldset" margin="normal" fullWidth>
          <M.FormLabel component="legend">Retrieval tier</M.FormLabel>
          <M.RadioGroup
            aria-label="retrieval tier"
            name="tier"
            value={tier}
            onChange={handleTierChange}
          >
            {TIER_OPTIONS.map((opt) => (
              <M.FormControlLabel
                key={opt.value}
                value={opt.value}
                control={<M.Radio color="primary" />}
                label={
                  <span>
                    {opt.label}
                    <M.Typography variant="caption" className={classes.hint}>
                      {opt.hint}
                    </M.Typography>
                  </span>
                }
              />
            ))}
          </M.RadioGroup>
        </M.FormControl>

        <M.TextField
          id="rehydrate-days"
          className={classes.daysField}
          label={`Keep restored copy for N days (${MIN_DAYS}–${MAX_DAYS})`}
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
            !daysValid ? `Enter a value between ${MIN_DAYS} and ${MAX_DAYS}.` : undefined
          }
          fullWidth
        />

        {errorMessage && (
          <Lab.Alert severity="error" className={classes.permissionHint}>
            {errorMessage}
            {showIamHint && (
              <>
                <br />
                Your IAM role needs <code>s3:RestoreObject</code> on this bucket.
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
