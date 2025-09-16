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

  return data.successors.find(({ slug }) => slug === bucket)
    ? data.successors
    : [bucketToSuccessor(bucket), ...data.successors]
}
