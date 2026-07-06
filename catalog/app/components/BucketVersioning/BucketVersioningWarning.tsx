import * as React from 'react'
import * as Lab from '@material-ui/lab'

import * as GQL from 'utils/GraphQL'
import { BucketVersioningState } from 'model/graphql/types.generated'

import BUCKET_VERSIONING_STATUS_QUERY from './gql/BucketVersioningStatus.generated'

// Advisory copy for the states we warn about. `ENABLED` and `UNKNOWN` are
// intentionally absent: versioning is fine when enabled, and we must not warn
// when the registry could not determine the state.
const WARNINGS: Partial<Record<BucketVersioningState, string>> = {
  [BucketVersioningState.SUSPENDED]:
    'S3 versioning is suspended for this bucket. Existing object versions are kept,' +
    ' but new writes will not be versioned, which prevents Quilt from preserving' +
    ' object and package history.',
  [BucketVersioningState.UNVERSIONED]:
    'This bucket has never had S3 versioning enabled. Quilt relies on versioning to' +
    ' preserve object and package history.',
}

interface BucketVersioningWarningProps {
  bucketName: string
  className?: string
}

// Advisory, non-blocking notice about a bucket's live S3 versioning state.
// Renders nothing while fetching, on error, or for ENABLED / UNKNOWN.
export default function BucketVersioningWarning({
  bucketName,
  className,
}: BucketVersioningWarningProps) {
  // Non-suspending query; stays silent on errors / while fetching. S3 bucket
  // names are at least 3 chars, so don't probe shorter (partial) input.
  const result = GQL.useQuery(
    BUCKET_VERSIONING_STATUS_QUERY,
    { name: bucketName },
    { pause: bucketName.length < 3 },
  )
  const warning = result.data && WARNINGS[result.data.bucketVersioningStatus]
  if (!warning) return null
  return (
    <Lab.Alert severity="warning" className={className}>
      {warning}
    </Lab.Alert>
  )
}
