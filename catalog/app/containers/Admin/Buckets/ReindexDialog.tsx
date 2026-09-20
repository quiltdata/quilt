import * as React from 'react'
import * as M from '@material-ui/core'

import * as Form from '../Form'
import * as APIConnector from 'utils/APIConnector'
import * as NamedRoutes from 'utils/NamedRoutes'
import StyledLink from 'utils/StyledLink'

interface ReindexProps {
  bucket: string
  open: boolean
  close: () => void
}

// APIConnector puts the raw body in `json.message` when it does not parse as JSON, so
// reading the message off the error would otherwise render an ALB or nginx error page
// as if the registry had said it. A null return means the response did not come from
// the registry, so the caller must not speak for the registry either.
function serverMessage(e: unknown): string | null {
  if (!(e instanceof APIConnector.HTTPError)) return null
  try {
    const { message, error } = JSON.parse(e.text)
    for (const v of [message, error]) {
      if (typeof v === 'string' && v) return v
    }
    return null
  } catch {
    return null
  }
}

function Reindex({ bucket, open, close }: ReindexProps) {
  const req = APIConnector.use()
  const { urls } = NamedRoutes.use()

  const [prefix, setPrefix] = React.useState('')
  const [repair, setRepair] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)
  const [submitSucceeded, setSubmitSucceeded] = React.useState(false)
  const [error, setError] = React.useState<string | false>(false)

  const reset = React.useCallback(() => {
    setSubmitting(false)
    setSubmitSucceeded(false)
    setPrefix('')
    setRepair(false)
    setError(false)
  }, [])

  const handleRepairChange = React.useCallback((_e, v) => {
    setRepair(v)
  }, [])

  const handlePrefixChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setPrefix(e.target.value)
      // A refusal names the prefix it was about, so it stops being true the moment the
      // prefix changes -- and the registry accepts distinct prefixes concurrently.
      setError(false)
    },
    [],
  )

  // The registry does not trim, and `if prefix:` there takes the prefix-scoped path for
  // whitespace: it would skip the index rebuild and match nothing, then return 200.
  const trimmedPrefix = prefix.trim()

  const reindex = React.useCallback(async () => {
    if (submitting) return
    setError(false)
    setSubmitting(true)
    try {
      // TODO: use graphql mutation
      await req({
        endpoint: `/admin/reindex/${bucket}`,
        method: 'POST',
        body: { repair: repair || undefined, prefix: trimmedPrefix || undefined },
      })
      setSubmitSucceeded(true)
    } catch (e) {
      if (APIConnector.HTTPError.is(e, 404, 'Bucket not found')) {
        setError('Bucket not found')
      } else if (APIConnector.HTTPError.is(e, 409) && serverMessage(e)) {
        // The registry refuses four distinct ways here (this prefix, a concurrent
        // prefix, full-bucket either way round), and only its own message says which;
        // collapsing them hides whether a different prefix would be accepted now.
        // A 409 with no registry message is a proxy's, so it falls through rather
        // than asserting a running job that may not exist.
        setError(serverMessage(e) as string)
      } else {
        // eslint-disable-next-line no-console
        console.log('Error re-indexing bucket:')
        // eslint-disable-next-line no-console
        console.error(e)
        setError('Unexpected error')
      }
    }
    setSubmitting(false)
  }, [submitting, req, bucket, trimmedPrefix, repair])

  const handleClose = React.useCallback(() => {
    if (submitting) return
    close()
  }, [submitting, close])

  return (
    <M.Dialog open={open} onClose={handleClose} onExited={reset} fullWidth>
      <M.DialogTitle>Re-index and repair a bucket</M.DialogTitle>
      {submitSucceeded ? (
        <M.DialogContent>
          <M.DialogContentText color="textPrimary">
            We have {repair && <>repaired S3 notifications and </>}
            started re-indexing{' '}
            {trimmedPrefix ? (
              <>
                keys beginning with{' '}
                <M.Box fontFamily="monospace.fontFamily" component="span">
                  {trimmedPrefix}
                </M.Box>
              </>
            ) : (
              <>the whole bucket</>
            )}
            .
          </M.DialogContentText>
          {!trimmedPrefix && (
            <M.Box color="warning.dark" mt={1}>
              <M.Typography color="inherit" variant="body2">
                Search for this bucket returns nothing until the rescan finishes.
              </M.Typography>
            </M.Box>
          )}
          <M.Box mt={1}>
            <M.Typography variant="body2">
              <StyledLink to={`${urls.adminStatus()}#indexing`}>
                View indexing status
              </StyledLink>
            </M.Typography>
          </M.Box>
        </M.DialogContent>
      ) : (
        <M.DialogContent>
          <M.DialogContentText color="textPrimary">
            You are about to start re-indexing the <b>&quot;{bucket}&quot;</b> bucket
          </M.DialogContentText>
          <M.TextField
            label="Key prefix"
            placeholder="Leave blank to re-index the whole bucket"
            helperText={
              trimmedPrefix
                ? 'Only keys beginning with this string are re-scanned, and the search indices are kept in place. Matching is literal, not path-aware: "data" also matches "database/".'
                : 'Every key is re-scanned and the search indices are recreated from scratch.'
            }
            fullWidth
            margin="normal"
            disabled={submitting}
            onChange={handlePrefixChange}
            value={prefix}
            InputLabelProps={{ shrink: true }}
          />
          {!!trimmedPrefix && (
            <M.Box color="warning.dark">
              <M.Typography color="inherit" variant="caption">
                Keys deleted under this prefix may stay in the index: only deletions S3
                still reports as delete markers are picked up. Re-index the whole bucket
                to clear the rest.
              </M.Typography>
            </M.Box>
          )}
          <Form.Checkbox
            meta={{ submitting, submitSucceeded }}
            // @ts-expect-error, FF.FieldInputProps misses second argument for onChange
            input={{ checked: repair, onChange: handleRepairChange }}
            label="Repair S3 notifications"
          />
          {repair && (
            <M.Box color="warning.dark" ml={4}>
              <M.Typography color="inherit" variant="caption">
                Bucket notifications will be overwritten
                {!!trimmedPrefix && <>, bucket-wide regardless of the prefix</>}
              </M.Typography>
            </M.Box>
          )}
        </M.DialogContent>
      )}
      <M.DialogActions>
        {submitting && (
          <M.Fade in style={{ transitionDelay: '1000ms' }}>
            <M.Box flexGrow={1} display="flex" pl={2}>
              <M.CircularProgress size={24} />
            </M.Box>
          </M.Fade>
        )}
        {!submitting && !!error && (
          <M.Box flexGrow={1} display="flex" alignItems="center" pl={2}>
            <M.Icon color="error">error_outline</M.Icon>
            <M.Box pl={1} />
            <M.Typography variant="body2" color="error">
              {error}
            </M.Typography>
          </M.Box>
        )}

        {submitSucceeded ? (
          <>
            <M.Button onClick={close} color="primary">
              Close
            </M.Button>
          </>
        ) : (
          <>
            <M.Button onClick={close} disabled={submitting} color="primary">
              Cancel
            </M.Button>
            <M.Button onClick={reindex} disabled={submitting} color="primary">
              Re-index
              {repair && <> and repair</>}
            </M.Button>
          </>
        )}
      </M.DialogActions>
    </M.Dialog>
  )
}

export default Reindex
