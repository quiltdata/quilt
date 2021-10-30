import * as R from 'ramda'
import * as React from 'react'

import * as AWS from 'utils/AWS'
import AsyncResult from 'utils/AsyncResult'
import * as BucketPreferences from 'utils/BucketPreferences'
import * as Data from 'utils/Data'
import type * as workflows from 'utils/workflows'

import * as PD from './PackageDialog'
import * as requests from './requests'

interface UsePackageUpdateDialogProps {
  bucket: string
  name: string
  hash?: string
  onExited: (result: {
    pushed: PD.PackageCreationSuccess | false
  }) => boolean | undefined | void
}

export function usePackageUpdateDialog({
  bucket,
  name,
  hash,
  onExited,
}: UsePackageUpdateDialogProps) {
  const s3 = AWS.S3.use()

  const [key, setKey] = React.useState(1)
  const [started, setStarted] = React.useState(false)

  const workflowsData = Data.use(requests.workflowsConfig, { s3, bucket })
  // XXX: use AsyncResult
  const preferences = BucketPreferences.use()
  const manifestData = Data.use(
    requests.loadManifest,
    { s3, bucket, name, hash, key },
    { noAutoFetch: !started },
  )

  const fetch = React.useCallback(() => {
    setStarted(true)
  }, [setStarted])

  const refresh = React.useCallback(() => {
    setStarted(false)
    setKey(R.inc)
  }, [setStarted, setKey])

  const data = React.useMemo(
    () =>
      workflowsData.case({
        Ok: (workflowsConfig: workflows.WorkflowsConfig) =>
          manifestData.case({
            Ok: (manifest: PD.Manifest) =>
              preferences
                ? AsyncResult.Ok({
                    manifest,
                    workflowsConfig,
                    sourceBuckets: preferences.ui.sourceBuckets,
                  })
                : AsyncResult.Pending(),
            _: R.identity,
          }),
        _: R.identity,
      }),
    [workflowsData, manifestData, preferences],
  )

  return PD.usePackageCreationDialog({
    bucket,
    data,
    fetch,
    name,
    onExited,
    refresh,
    ui: {
      resetFiles: 'Undo changes',
      submit: 'Push',
      successBrowse: 'Browse',
      successTitle: 'Push complete',
      successRenderMessage: ({ packageLink }) => (
        <>Package revision {packageLink} successfully created</>
      ),
      title: 'Push package revision',
    },
  })
}
