import * as React from 'react'

import * as AWS from 'utils/AWS'
import * as Request from 'utils/useRequest'
import type { Successor } from 'utils/workflows'

import { workflowsConfig } from '../../requests'

export default function useSuccessors(bucket: string): Request.Result<Successor[]> {
  const s3 = AWS.S3.use()
  const req = React.useCallback(() => workflowsConfig({ s3, bucket }), [bucket, s3])
  const data = Request.use(req)

  if (data instanceof Error || data === Request.Idle || data === Request.Loading) {
    return data
  }

  return data.successors
}
