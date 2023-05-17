import * as R from 'ramda'

import { L } from 'components/Form/Package/types'
import * as AWS from 'utils/AWS'
import * as Data from 'utils/Data'
import type { WorkflowsConfig } from 'utils/workflows'

import * as requests from '../../requests'

export default function useWorkflowsConfig(
  bucket: string | null,
): WorkflowsConfig | Error | typeof L {
  const s3 = AWS.S3.use()
  const workflowsData = Data.use(
    requests.workflowsConfig,
    { s3, bucket },
    { noAutoFetch: !bucket },
  )
  return workflowsData.case({
    Ok: R.identity,
    Err: R.identity,
    _: () => L,
  })
}
