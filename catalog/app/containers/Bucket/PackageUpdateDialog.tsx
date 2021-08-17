import * as R from 'ramda'
import * as React from 'react'
import { Link } from 'react-router-dom'
import * as M from '@material-ui/core'

import * as Intercom from 'components/Intercom'
import * as AWS from 'utils/AWS'
import * as BucketPreferences from 'utils/BucketPreferences'
import * as Data from 'utils/Data'
import * as NamedRoutes from 'utils/NamedRoutes'
import StyledLink from 'utils/StyledLink'
import type * as workflows from 'utils/workflows'

import * as PD from './PackageDialog'
import * as requests from './requests'

const useDialogStyles = M.makeStyles({
  content: {
    paddingTop: 0,
  },
})

interface DialogPlaceholderProps {
  close?: () => void
}

function DialogPlaceholder({ close }: DialogPlaceholderProps) {
  const classes = useDialogStyles()
  return (
    <>
      <M.DialogTitle>Push package revision</M.DialogTitle>
      <M.DialogContent className={classes.content}>
        <PD.FormSkeleton />
      </M.DialogContent>
      <M.DialogActions>
        <M.Button onClick={close}>Cancel</M.Button>
        <M.Button variant="contained" color="primary" disabled>
          Push
        </M.Button>
      </M.DialogActions>
    </>
  )
}

interface DialogErrorProps {
  error: any
  close: () => void
}

function DialogError({ error, close }: DialogErrorProps) {
  return (
    <PD.DialogError
      error={error}
      skeletonElement={<PD.FormSkeleton animate={false} />}
      title="Push package revision"
      onCancel={close}
    />
  )
}

interface DialogSuccessProps {
  bucket: string
  close: () => void
  hash: string
  name: string
}

function DialogSuccess({ bucket, name, hash, close }: DialogSuccessProps) {
  const { urls } = NamedRoutes.use()
  const classes = useDialogStyles()
  return (
    <>
      <M.DialogTitle>Push complete</M.DialogTitle>
      <M.DialogContent className={classes.content}>
        <M.Typography>
          Package revision{' '}
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
          Browse
        </M.Button>
      </M.DialogActions>
    </>
  )
}

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
            Loading: () => <DialogPlaceholder close={close} />,
            Error: (e) => <DialogError close={close} error={e} />,
            Form: ({ manifest, workflowsConfig, sourceBuckets }) => (
              <PD.SchemaFetcher
                manifest={manifest}
                workflowsConfig={workflowsConfig}
                workflow={workflow}
              >
                {(schemaProps) => (
                  <PD.PackageCreationForm
                    {...schemaProps}
                    {...{
                      bucket,
                      close,
                      setSubmitting,
                      setSuccess,
                      setWorkflow,
                      workflowsConfig,
                      sourceBuckets,
                      initial: { manifest, name },
                      ui: {
                        title: 'Push package revision',
                        submit: 'Push',
                      },
                    }}
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
    [bucket, name, isOpen, exited, close, state, success, handleExited, workflow],
  )

  return React.useMemo(() => ({ open, close, render }), [open, close, render])
}

export const use = usePackageUpdateDialog
