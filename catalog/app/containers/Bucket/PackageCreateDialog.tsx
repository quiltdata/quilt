import * as R from 'ramda'
import * as React from 'react'

import * as AWS from 'utils/AWS'
import AsyncResult from 'utils/AsyncResult'
import * as BucketPreferences from 'utils/BucketPreferences'
import * as Data from 'utils/Data'
import type * as workflows from 'utils/workflows'

import * as PD from './PackageDialog'
import * as requests from './requests'

interface UsePackageCreateDialogProps {
  bucket: string
  onExited: (result: {
    pushed: PD.PackageCreationSuccess | false
  }) => boolean | undefined | void
}

export function usePackageCreateDialog({
  bucket,
  onExited,
}: UsePackageCreateDialogProps) {
  const s3 = AWS.S3.use()

  const workflowsData = Data.use(requests.workflowsConfig, { s3, bucket })
  // XXX: use AsyncResult
  const preferences = BucketPreferences.use()

  const data = workflowsData.case({
    Ok: (workflowsConfig: workflows.WorkflowsConfig) =>
      preferences
        ? AsyncResult.Ok({
            workflowsConfig,
            sourceBuckets: preferences.ui.sourceBuckets,
          })
        : AsyncResult.Pending(),
    _: R.identity,
  })

  return PD.usePackageCreationDialog({
    bucket,
    data,
    delayHashing: true,
    disableStateDisplay: true,
    onExited,
    ui: {
      successTitle: 'Package created',
      successRenderMessage: ({ packageLink }) => (
        <>Package {packageLink} successfully created</>
      ),
      title: 'Create package',
    },
  })
}
