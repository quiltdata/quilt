import * as R from 'ramda'
import * as React from 'react'

import * as Intercom from 'components/Intercom'
import * as AWS from 'utils/AWS'
import * as BucketPreferences from 'utils/BucketPreferences'
import * as Data from 'utils/Data'
import type * as workflows from 'utils/workflows'

import * as PD from './PackageDialog'
import * as requests from './requests'

interface UsePackageUpdateDialogProps {
  bucket: string
  name: string
  hash: string
  onExited: (result: { pushed: false | PD.PackageCreationSuccess }) => boolean
}

export function usePackageUpdateDialog({
  bucket,
  name,
  hash,
  onExited,
}: UsePackageUpdateDialogProps) {
  const s3 = AWS.S3.use()

  const [isOpen, setOpen] = React.useState(false)
  const [wasOpened, setWasOpened] = React.useState(false)
  const [exited, setExited] = React.useState(!isOpen)
  const [success, setSuccess] = React.useState<PD.PackageCreationSuccess | false>(false)
  const [submitting, setSubmitting] = React.useState(false)
  const [key, setKey] = React.useState(1)
  const [workflow, setWorkflow] = React.useState<workflows.Workflow>()

  const workflowsData = Data.use(requests.workflowsConfig, { s3, bucket })
  // const workflowsData = Data.use(requests.workflowsConfig, { s3, bucket }, { noAutoFetch: !wasOpened })
  // XXX: use AsyncResult
  const preferences = BucketPreferences.use()
  const manifestData = Data.use(
    requests.loadManifest,
    { s3, bucket, name, hash, key },
    { noAutoFetch: !wasOpened },
  )

  const open = React.useCallback(() => {
    setOpen(true)
    setWasOpened(true)
    setExited(false)
  }, [setOpen, setWasOpened, setExited])

  const close = React.useCallback(() => {
    if (submitting) return
    setOpen(false)
    setWorkflow(undefined) // TODO: is this necessary?
  }, [submitting, setOpen])

  const refreshManifest = React.useCallback(() => {
    setWasOpened(false)
    setKey(R.inc)
  }, [setWasOpened, setKey])

  const handleExited = React.useCallback(() => {
    setExited(true)
    setSuccess(false)
    if (onExited) {
      const shouldRefreshManifest = onExited({ pushed: success })
      if (shouldRefreshManifest) refreshManifest()
    }
  }, [setExited, setSuccess, success, onExited, refreshManifest])

  Intercom.usePauseVisibilityWhen(isOpen)

  const state = React.useMemo<PD.PackageCreationDialogState>(() => {
    if (exited) return PD.PackageCreationDialogState.Closed()
    if (success) return PD.PackageCreationDialogState.Success(success)
    return workflowsData.case({
      Ok: (workflowsConfig: workflows.WorkflowsConfig) =>
        manifestData.case({
          Ok: (manifest: PD.Manifest) =>
            preferences
              ? PD.PackageCreationDialogState.Form({
                  manifest,
                  workflowsConfig,
                  sourceBuckets: preferences.ui.sourceBuckets,
                })
              : PD.PackageCreationDialogState.Loading(),
          Err: PD.PackageCreationDialogState.Error,
          _: PD.PackageCreationDialogState.Loading,
        }),
      Err: PD.PackageCreationDialogState.Error,
      _: PD.PackageCreationDialogState.Loading,
    })
  }, [exited, success, workflowsData, manifestData, preferences])

  const element = (
    <PD.PackageCreationDialog
      state={state}
      ui={{
        resetFiles: 'Undo changes',
        submit: 'Push',
        successBrowse: 'Browse',
        successTitle: 'Package created',
        successRenderMessage: ({ packageLink }) => (
          <>Package revision {packageLink} successfully created</>
        ),
        title: 'Push package revision',
      }}
      {...{
        bucket,
        close,
        exited,
        onExited: handleExited,
        isOpen,
        name,
        setSubmitting,
        setSuccess,
        setWorkflow,
        success,
        workflow,
      }}
    />
  )

  return { open, close, element }
}
