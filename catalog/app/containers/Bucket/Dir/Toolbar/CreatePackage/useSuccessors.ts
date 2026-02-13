import * as React from 'react'

import { workflowsConfig } from 'containers/Bucket/requests'
import * as AWS from 'utils/AWS'
import * as Request from 'utils/useRequest'
import { bucketToSuccessor } from 'utils/workflows'
import type { Successor } from 'utils/workflows'

export default function useSuccessors(bucket: string): Request.Result<Successor[]> {
  const s3 = AWS.S3.use()
  const req = React.useCallback(() => workflowsConfig({ s3, bucket }), [bucket, s3])
  const data = Request.use(req)

  if (data instanceof Error || data === Request.Idle || data === Request.Loading) {
    return data
  }

  // If successors are defined in config, use them as-is (don't auto-add current bucket)
  // If no successors defined, add current bucket as default
  return data.successors.length > 0 ? data.successors : [bucketToSuccessor(bucket)]
}
