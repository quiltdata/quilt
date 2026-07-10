import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'
import { fade } from '@material-ui/core/styles'
import * as Lab from '@material-ui/lab'

import * as GQL from 'utils/GraphQL'
import StyledLink from 'utils/StyledLink'
import { BucketVersioningState } from 'model/graphql/types.generated'

import BUCKET_VERSIONING_STATUS_QUERY from './gql/BucketVersioningStatus.generated'

// Quilt's own admin docs, which recommend bucket versioning and cover the
// related lifecycle guidance (preferred over linking out to AWS). Deep-linked
// to the versioning section so it doesn't land at the top of the page.
const VERSIONING_DOC =
  'https://docs.quilt.bio/quilt-platform-administrator/installation#before-you-install-quilt'

// S3 bucket names are at least 3 chars, so don't probe shorter (partial) input.
const MIN_BUCKET_NAME_LENGTH = 3

const EnableVersioningLink = (
  <StyledLink href={VERSIONING_DOC} target="_blank">
    Learn about bucket versioning
  </StyledLink>
)

// This app's `palette.warning.main` is a pale `yellow[200]`, so the default
// `standard` warning tint (and its icon) come out much lighter than the
// success/info/error alerts. Darken just the warning states to match that
// weight: a light-amber background tint derived from `warning.dark` and a
// readable dark-amber icon, keeping the default dark text (legible on the light
// amber). Still `variant="standard"` — no border, no solid fill.
const useStatusAlertStyles = M.makeStyles((t) => ({
  warning: {
    backgroundColor: fade(t.palette.warning.dark, 0.1),
    '& .MuiAlert-icon': { color: t.palette.warning.dark },
  },
}))

interface RefreshButtonProps {
  disabled: boolean
  onClick: () => void
}

// Manual live re-read: re-runs the query with `network-only` so it bypasses the
// urql cache. This also works around the cache-first behavior where a bucket
// whose versioning was just enabled would otherwise keep showing the stale
// (cached) status for the rest of the session.
function RefreshButton({ disabled, onClick }: RefreshButtonProps) {
  return (
    <M.Tooltip title="Re-check versioning" arrow>
      <M.IconButton size="small" color="inherit" onClick={onClick} disabled={disabled}>
        <M.Icon fontSize="small">refresh</M.Icon>
      </M.IconButton>
    </M.Tooltip>
  )
}

interface StatusAlertProps {
  severity: Lab.Color
  icon?: React.ReactNode
  className?: string
  refresh: RefreshButtonProps
  children: React.ReactNode
}

// Plain `standard` variant; the warning states get a slightly darker amber
// tint + icon (see `useStatusAlertStyles`) so they match the weight of the
// other standard alerts instead of the pale default yellow.
function StatusAlert({ severity, icon, className, refresh, children }: StatusAlertProps) {
  const classes = useStatusAlertStyles()
  return (
    <Lab.Alert
      variant="standard"
      severity={severity}
      icon={icon}
      className={cx(severity === 'warning' && classes.warning, className)}
      action={<RefreshButton {...refresh} />}
    >
      {children}
    </Lab.Alert>
  )
}

interface BucketVersioningStatusProps {
  bucketName: string
  className?: string
}

// Always-visible status box reporting a bucket's live S3 versioning state.
// Covers idle / loading / each versioning state / transient error, and offers a
// manual (network-only) re-check.
export default function BucketVersioningStatus({
  bucketName,
  className,
}: BucketVersioningStatusProps) {
  const tooShort = bucketName.length < MIN_BUCKET_NAME_LENGTH
  // Non-suspending query; we render every state explicitly rather than
  // throwing / suspending.
  const result = GQL.useQuery(
    BUCKET_VERSIONING_STATUS_QUERY,
    { name: bucketName },
    { pause: tooShort },
  )

  const refresh = React.useCallback(
    () => result.run({ requestPolicy: 'network-only' }),
    [result],
  )
  const refreshProps: RefreshButtonProps = { onClick: refresh, disabled: result.fetching }

  // Idle: nothing to check yet. Rendered through the same StatusAlert container
  // as the result states (info severity) so the box keeps a constant shape and
  // doesn't jump on the idle -> loading -> result transitions. Refresh is
  // disabled since there's no bucket to re-check.
  if (tooShort) {
    return (
      <StatusAlert
        severity="info"
        className={className}
        refresh={{ onClick: refresh, disabled: true }}
      >
        Enter a bucket name to check S3 versioning.
      </StatusAlert>
    )
  }

  // Loading: initial fetch (no data yet). Same info container; the spinner takes
  // the Alert's icon slot in place of the severity icon.
  if (result.fetching && !result.data) {
    return (
      <StatusAlert
        severity="info"
        className={className}
        refresh={refreshProps}
        icon={<M.CircularProgress size={16} color="inherit" />}
      >
        Checking versioning…
      </StatusAlert>
    )
  }

  // The query returns a union of the success payload and the standard
  // OperationError type. Discriminate on `__typename`: OperationError (or a
  // hard query error with no data at all) renders the transient box, using the
  // OperationError `message` as the reason.
  const status = result.data?.bucketVersioningStatus
  if (!status || status.__typename === 'OperationError') {
    return (
      <StatusAlert
        severity="warning"
        className={className}
        refresh={refreshProps}
        icon={<M.Icon fontSize="inherit">sync_problem</M.Icon>}
      >
        {status?.message || "Couldn't reach S3."} Try again.
      </StatusAlert>
    )
  }

  switch (status.state) {
    case BucketVersioningState.ENABLED:
      return (
        <StatusAlert
          severity="success"
          className={className}
          refresh={refreshProps}
          icon={<M.Icon fontSize="inherit">check_circle</M.Icon>}
        >
          S3 versioning is enabled.
        </StatusAlert>
      )

    case BucketVersioningState.SUSPENDED:
      return (
        <StatusAlert severity="warning" className={className} refresh={refreshProps}>
          Versioning is suspended — new writes are no longer versioned.{' '}
          {EnableVersioningLink}
        </StatusAlert>
      )

    case BucketVersioningState.UNVERSIONED:
      return (
        <StatusAlert severity="warning" className={className} refresh={refreshProps}>
          This bucket has never had S3 versioning enabled. {EnableVersioningLink}
        </StatusAlert>
      )

    case BucketVersioningState.NOT_FOUND:
      return (
        <StatusAlert severity="error" className={className} refresh={refreshProps}>
          No bucket named “{bucketName}” found, or it's not accessible.
        </StatusAlert>
      )

    case BucketVersioningState.ACCESS_DENIED:
      return (
        <StatusAlert severity="warning" className={className} refresh={refreshProps}>
          Quilt can't read this bucket's versioning — grant{' '}
          <code>s3:GetBucketVersioning</code> (or add a bucket policy for a cross-account
          bucket).
        </StatusAlert>
      )

    default:
      return null
  }
}
