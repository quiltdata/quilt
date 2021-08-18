import * as React from 'react'
import * as redux from 'react-redux'

import * as Intercom from 'components/Intercom'
import * as authSelectors from 'containers/Auth/selectors'
import * as AWS from 'utils/AWS'
import * as BucketPreferences from 'utils/BucketPreferences'
import * as Data from 'utils/Data'
import type * as workflows from 'utils/workflows'

import * as PD from './PackageDialog'
import * as requests from './requests'

interface UsePackageCreateDialogProps {
  bucket: string
  onExited: (result: { pushed: false | PD.PackageCreationSuccess }) => boolean
}

export function usePackageCreateDialog({
  bucket,
  onExited,
}: UsePackageCreateDialogProps) {
  const s3 = AWS.S3.use()

  const [isOpen, setOpen] = React.useState(false)
  // const [wasOpened, setWasOpened] = React.useState(false)
  const [exited, setExited] = React.useState(!isOpen)
  const [success, setSuccess] = React.useState<PD.PackageCreationSuccess | false>(false)
  const [submitting, setSubmitting] = React.useState(false)
  // const [key, setKey] = React.useState(1)
  const [workflow, setWorkflow] = React.useState<workflows.Workflow>()

  const workflowsData = Data.use(requests.workflowsConfig, { s3, bucket })
  // const workflowsData = Data.use(requests.workflowsConfig, { s3, bucket }, { noAutoFetch: !wasOpened })
  // XXX: use AsyncResult
  const preferences = BucketPreferences.use()

  const open = React.useCallback(() => {
    setOpen(true)
    // setWasOpened(true)
    setExited(false)
  }, [setOpen, /* setWasOpened, */ setExited])

  const close = React.useCallback(() => {
    if (submitting) return
    setOpen(false)
    setWorkflow(undefined) // TODO: is this necessary?
  }, [submitting, setOpen])

  const handleExited = React.useCallback(() => {
    setExited(true)
    setSuccess(false)
    if (onExited) {
      onExited({ pushed: success })
    }
  }, [setExited, setSuccess, success, onExited])

  Intercom.usePauseVisibilityWhen(isOpen)

  const username = redux.useSelector(authSelectors.username)
  const usernamePrefix = React.useMemo(() => PD.getUsernamePrefix(username), [username])

  const state = React.useMemo<PD.PackageCreationDialogState>(() => {
    if (exited) return PD.PackageCreationDialogState.Closed()
    if (success) return PD.PackageCreationDialogState.Success(success)
    return workflowsData.case({
      Ok: (workflowsConfig: workflows.WorkflowsConfig) =>
        preferences
          ? PD.PackageCreationDialogState.Form({
              workflowsConfig,
              sourceBuckets: preferences.ui.sourceBuckets,
            })
          : PD.PackageCreationDialogState.Loading(),
      Err: PD.PackageCreationDialogState.Error,
      _: PD.PackageCreationDialogState.Loading,
    })
  }, [exited, success, workflowsData, preferences])

  const element = (
    <PD.PackageCreationDialog
      state={state}
      delayHashing
      disableStateDisplay
      ui={{
        successTitle: 'Package created',
        successRenderMessage: ({ packageLink }) => (
          <>Package {packageLink} successfully created</>
        ),
        title: 'Create package',
      }}
      {...{
        bucket,
        close,
        exited,
        onExited: handleExited,
        isOpen,
        name: usernamePrefix,
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
