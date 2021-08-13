// import cx from 'classnames'
import * as FF from 'final-form'
import * as R from 'ramda'
import * as React from 'react'
import { Link } from 'react-router-dom'
import * as redux from 'react-redux'
import * as M from '@material-ui/core'

import * as Intercom from 'components/Intercom'
import * as authSelectors from 'containers/Auth/selectors'
import AsyncResult from 'utils/AsyncResult'
import * as AWS from 'utils/AWS'
import * as BucketPreferences from 'utils/BucketPreferences'
import { useData } from 'utils/Data'
import * as NamedRoutes from 'utils/NamedRoutes'
import StyledLink from 'utils/StyledLink'
import type * as workflows from 'utils/workflows'

import * as PD from './PackageDialog'
import * as requests from './requests'

import * as PUD from './PackageUpdateDialog'

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

interface PackageCreateDialogProps {
  bucket: string
  close: () => void
  refresh: () => void
  responseError: Error
  schema: $TSFixMe
  schemaLoading: boolean
  selectedWorkflow: workflows.Workflow
  setSubmitting: (submitting: boolean) => void
  setSuccess: (success: { name: string; hash: string }) => void
  setWorkflow: (workflow: workflows.Workflow) => void
  sourceBuckets: BucketPreferences.SourceBuckets
  validate: FF.FieldValidator<any>
  workflowsConfig: workflows.WorkflowsConfig
}

function PackageCreateDialog({
  bucket,
  close,
  refresh,
  responseError,
  schema,
  schemaLoading,
  selectedWorkflow,
  setSubmitting,
  setSuccess,
  setWorkflow,
  sourceBuckets,
  validate,
  workflowsConfig,
}: PackageCreateDialogProps) {
  const username = redux.useSelector(authSelectors.username)
  const usernamePrefix = React.useMemo(() => PD.getUsernamePrefix(username), [username])
  // TODO: customize ui:
  // submit action: Create
  // dialog header: Create package
  // files:
  //   dont treat added files specially
  //   undo changes -> clear files
  return (
    <PUD.DialogForm
      {...{
        bucket,
        close,
        initial: {
          name: usernamePrefix,
        },
        refresh,
        responseError,
        schema,
        schemaLoading,
        selectedWorkflow,
        setSubmitting,
        setSuccess,
        setWorkflow,
        sourceBuckets,
        validate,
        workflowsConfig,
      }}
    />
  )
}

interface PackageCreateDialogWrapperProps {
  bucket: string
  open: boolean
  onClose: () => void
  refresh: () => void
}

export default function PackageCreateDialogWrapper({
  bucket,
  open,
  onClose,
  refresh,
}: PackageCreateDialogWrapperProps) {
  const s3 = AWS.S3.use()
  const data = useData(requests.workflowsConfig, { s3, bucket }, { noAutoFetch: !open })
  // XXX: use AsyncResult
  const preferences = BucketPreferences.use()

  const [workflow, setWorkflow] = React.useState<workflows.Workflow>()
  const [success, setSuccess] = React.useState<{ name: string; hash: string } | false>()
  const [submitting, setSubmitting] = React.useState(false)

  const close = React.useCallback(() => {
    if (submitting && !success) return

    setWorkflow(undefined)
    onClose()
  }, [submitting, success, onClose])

  Intercom.usePauseVisibilityWhen(open)

  return (
    <M.Dialog
      fullWidth
      maxWidth={success ? 'sm' : 'lg'}
      onClose={close}
      onExited={close}
      open={open}
      scroll="body"
    >
      {data.case({
        Ok: (workflowsConfig: workflows.WorkflowsConfig) =>
          success ? (
            <DialogSuccess
              bucket={bucket}
              hash={success.hash}
              name={success.name}
              close={close}
            />
          ) : (
            <PD.SchemaFetcher workflow={workflow} workflowsConfig={workflowsConfig}>
              {AsyncResult.case({
                Ok: (schemaProps: $TSFixMe) =>
                  preferences ? (
                    <PackageCreateDialog
                      {...schemaProps}
                      {...{
                        bucket,
                        close,
                        setSubmitting,
                        setSuccess,
                        setWorkflow,
                        workflowsConfig,
                        sourceBuckets: preferences.ui.sourceBuckets,

                        refresh,
                      }}
                    />
                  ) : (
                    <PD.DialogLoading
                      skeletonElement={<PD.FormSkeleton />}
                      title="Create package"
                      onCancel={close}
                    />
                  ),
                _: R.identity,
              })}
            </PD.SchemaFetcher>
          ),
        Err: (error: Error) => (
          <PD.DialogError
            error={error}
            skeletonElement={<PD.FormSkeleton animate={false} />}
            title="Create package"
            onCancel={close}
          />
        ),
        _: () => (
          <PD.DialogLoading
            skeletonElement={<PD.FormSkeleton />}
            title="Create package"
            onCancel={close}
          />
        ),
      })}
    </M.Dialog>
  )
}
