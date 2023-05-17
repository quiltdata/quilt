import * as R from 'ramda'
import * as React from 'react'

import { L } from 'components/Form/Package/types'
import * as AWS from 'utils/AWS'
import * as Data from 'utils/Data'
// import type * as workflows from 'utils/workflows'

import * as requests from '../../requests'

export default function useWorkflowsConfig() {
  const s3 = AWS.S3.use()
  return React.useCallback(
    (bucket: string | null) => requests.workflowsConfig({ s3, bucket }),
    [s3],
  )
  // const workflowsData = Data.use(
  //   requests.workflowsConfig,
  //   { s3, bucket },
  //   { noAutoFetch: !bucket },
  // )
  // return workflowsData.case({
  //   Ok: R.identity,
  //   Err: R.identity,
  //   _: () => L,
  // })
}
