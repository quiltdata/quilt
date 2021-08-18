import * as R from 'ramda'
import * as React from 'react'
import { Link } from 'react-router-dom'
import * as redux from 'react-redux'
import * as M from '@material-ui/core'

import * as Intercom from 'components/Intercom'
import * as authSelectors from 'containers/Auth/selectors'
import * as AWS from 'utils/AWS'
import * as BucketPreferences from 'utils/BucketPreferences'
import * as Data from 'utils/Data'
import * as NamedRoutes from 'utils/NamedRoutes'
import StyledLink from 'utils/StyledLink'
import type * as workflows from 'utils/workflows'

import * as PD from './PackageDialog'
import * as requests from './requests'

const useDialogSuccessStyles = M.makeStyles({
  content: {
    paddingTop: 0,
  },
})

interface DialogSuccessProps {
  bucket: string
  close: () => void
  hash: string
  name: string
}

function DialogSuccess({ bucket, name, hash, close }: DialogSuccessProps) {
  const { urls } = NamedRoutes.use()
  const classes = useDialogSuccessStyles()
  return (
    <>
      <M.DialogTitle>Package created</M.DialogTitle>
      <M.DialogContent className={classes.content}>
        <M.Typography>
          Package{' '}
          <StyledLink to={urls.bucketPackageTree(bucket, name, hash)}>
            {name}@{R.take(10, hash)}
          </StyledLink>{' '}
          successfully created
        </M.Typography>
      </M.DialogContent>
      <M.DialogActions>
        <M.Button onClick={close}>Close</M.Button>
        <M.Button
          component={Link}
          to={urls.bucketPackageTree(bucket, name, hash)}
          variant="contained"
          color="primary"
        >
          Browse package
        </M.Button>
      </M.DialogActions>
    </>
  )
}

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
    // setWorkflow(undefined) // TODO: is this necessary?
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

  const render = React.useCallback(
    () => (
      <PD.DialogWrapper
        exited={exited}
        fullWidth
        maxWidth={success ? 'sm' : 'lg'}
        onClose={close}
        onExited={handleExited}
        open={isOpen}
        scroll="body"
      >
        {PD.PackageCreationDialogState.match(
          {
            Closed: () => null,
            Loading: () => (
              <PD.DialogLoading
                skeletonElement={<PD.FormSkeleton />}
                title="Create package"
                onCancel={close}
              />
            ),
            Error: (e) => (
              <PD.DialogError
                error={e}
                skeletonElement={<PD.FormSkeleton animate={false} />}
                title="Create package"
                onCancel={close}
              />
            ),
            Form: ({ workflowsConfig, sourceBuckets }) => (
              <PD.SchemaFetcher workflow={workflow} workflowsConfig={workflowsConfig}>
                {(schemaProps) => (
                  <PD.PackageCreationForm
                    {...schemaProps}
                    {...{
                      bucket,
                      close,
                      initial: {
                        name: usernamePrefix,
                      },
                      setSubmitting,
                      setSuccess,
                      setWorkflow,
                      sourceBuckets,
                      workflowsConfig,
                    }}
                    delayHashing
                    disableStateDisplay
                  />
                )}
              </PD.SchemaFetcher>
            ),
            Success: (props) => <DialogSuccess {...{ bucket, close, ...props }} />,
          },
          state,
        )}
      </PD.DialogWrapper>
    ),
    [
      bucket,
      usernamePrefix,
      isOpen,
      exited,
      close,
      state,
      success,
      handleExited,
      workflow,
    ],
  )

  return React.useMemo(() => ({ open, close, render }), [open, close, render])
}
