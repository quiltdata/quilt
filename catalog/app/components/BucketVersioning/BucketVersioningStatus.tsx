import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import * as GQL from 'utils/GraphQL'
import StyledLink from 'utils/StyledLink'
import { BucketVersioningState } from 'model/graphql/types.generated'

import BUCKET_VERSIONING_STATUS_QUERY from './gql/BucketVersioningStatus.generated'

// AWS docs on enabling / configuring S3 bucket versioning. Quilt's own docs
// don't have a dedicated "enable versioning" page, so we link out to AWS
// (same approach as the S3 Glacier restore docs link in RehydrateDialog).
const S3_VERSIONING_DOC =
  'https://docs.aws.amazon.com/AmazonS3/latest/userguide/manage-versioning-examples.html'

// S3 bucket names are at least 3 chars, so don't probe shorter (partial) input.
const MIN_BUCKET_NAME_LENGTH = 3

const EnableVersioningLink = (
  <StyledLink href={S3_VERSIONING_DOC} target="_blank">
    Learn how to enable versioning
  </StyledLink>
)

const useStyles = M.makeStyles((t) => ({
  idle: {
    color: t.palette.text.secondary,
  },
  loading: {
    alignItems: 'center',
    color: t.palette.text.secondary,
    display: 'flex',
  },
  spinner: {
    marginRight: t.spacing(1),
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
    <M.Tooltip title="Re-check versioning">
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

// Higher-contrast than the default outlined look: `standard` renders a solid
// tinted background with a colored icon, giving success and warning equal weight.
function StatusAlert({ severity, icon, className, refresh, children }: StatusAlertProps) {
  return (
    <Lab.Alert
      variant="standard"
      severity={severity}
      icon={icon}
      className={className}
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
  const classes = useStyles()
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

  // Idle: nothing to check yet.
  if (tooShort) {
    return (
      <M.Typography variant="body2" className={cx(classes.idle, className)}>
        Enter a bucket name to check S3 versioning.
      </M.Typography>
    )
  }

  // Loading: initial fetch (no data yet).
  if (result.fetching && !result.data) {
    return (
      <M.Typography variant="body2" className={cx(classes.loading, className)}>
        <M.CircularProgress size={16} className={classes.spinner} />
        Checking versioning…
      </M.Typography>
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
