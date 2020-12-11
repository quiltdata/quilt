import * as R from 'ramda'
import { FORM_ERROR } from 'final-form'
import * as React from 'react'
import * as RF from 'react-final-form'
import * as M from '@material-ui/core'

import AsyncResult from 'utils/AsyncResult'
import * as APIConnector from 'utils/APIConnector'
import * as AWS from 'utils/AWS'
import * as Data from 'utils/Data'
import Delay from 'utils/Delay'
import * as NamedRoutes from 'utils/NamedRoutes'
import Skeleton from 'components/Skeleton'
import StyledLink from 'utils/StyledLink'
import tagged from 'utils/tagged'
import * as validators from 'utils/validators'

import * as PD from './PackageDialog'
import * as requests from './requests'

function requestPackageCopy(
  req,
  { commitMessage, hash, initialName, meta, name, sourceBucket, targetBucket, workflow },
) {
  return req({
    endpoint: '/packages/promote',
    method: 'POST',
    body: {
      message: commitMessage,
      meta: PD.getMetaValue(meta),
      name,
      parent: {
        top_hash: hash,
        registry: `s3://${sourceBucket}`,
        name: initialName,
      },
      registry: `s3://${targetBucket}`,
      workflow: PD.getWorkflowApiParam(workflow.slug),
    },
  })
}

function FormSkeleton({ animate }) {
  const headerSkeleton = <Skeleton {...{ height: 48, mt: 2, animate }} />
  const inputsSkeleton = <Skeleton {...{ height: 48, mt: 3, animate }} />
  const metadataSkeleton = (
    <M.Box mt={3}>
      <M.Box display="flex" mb={2}>
        <Skeleton {...{ height: 24, width: 64, animate }} />
        <M.Box flexGrow={1} />
        <Skeleton {...{ height: 24, width: 64, animate }} />
      </M.Box>
      <M.Box display="flex">
        <Skeleton {...{ height: 32, width: 200, animate }} />
        <Skeleton {...{ height: 32, ml: 0.5, flexGrow: 1, animate }} />
      </M.Box>
      <M.Box display="flex" mt={0.5}>
        <Skeleton {...{ height: 32, width: 200, animate }} />
        <Skeleton {...{ height: 32, ml: 0.5, flexGrow: 1, animate }} />
      </M.Box>
    </M.Box>
  )
  const workflowSkeleton = <Skeleton {...{ height: 80, mt: 3, mb: 3, animate }} />
  return (
    <>
      {headerSkeleton}
      {inputsSkeleton}
      {metadataSkeleton}
      {workflowSkeleton}
    </>
  )
}

function DialogTitle({ bucket }) {
  const { urls } = NamedRoutes.use()

  return (
    <M.DialogTitle>
      Push package to{' '}
      <StyledLink target="_blank" to={urls.bucketOverview(bucket)}>
        {bucket}
      </StyledLink>{' '}
      bucket
    </M.DialogTitle>
  )
}

function DialogForm({
  close,
  hash,
  manifest,
  name: initialName,
  onSubmitEnd,
  onSubmitStart,
  bucket,
  onSuccess,
  successor,
  workflowsConfig,
}) {
  const nameValidator = PD.useNameValidator()

  const initialMeta = React.useMemo(
    () => ({
      mode: 'kv',
      text: JSON.stringify(manifest.meta || {}),
    }),
    [manifest.meta],
  )

  const req = APIConnector.use()

  // eslint-disable-next-line consistent-return
  const onSubmit = async ({ commitMessage, name, meta, workflow }) => {
    onSubmitStart()
    try {
      const res = await requestPackageCopy(req, {
        commitMessage,
        hash,
        initialName,
        meta,
        name,
        sourceBucket: bucket,
        targetBucket: successor.slug,
        workflow,
      })
      onSubmitEnd()
      onSuccess({ name, hash: res.top_hash })
    } catch (e) {
      onSubmitEnd()
      // eslint-disable-next-line no-console
      console.log('error creating manifest', e)
      return { [FORM_ERROR]: e.message || PD.ERROR_MESSAGES.MANIFEST }
    }
  }

  return (
    <RF.Form onSubmit={onSubmit}>
      {({
        handleSubmit,
        submitting,
        submitFailed,
        error,
        submitError,
        hasValidationErrors,
        form,
        values,
      }) => (
        <>
          <DialogTitle bucket={successor.slug} />
          <M.DialogContent style={{ paddingTop: 0 }}>
            <form onSubmit={handleSubmit}>
              <RF.Field
                component={PD.Field}
                name="name"
                label="Name"
                placeholder="Enter a package name"
                validate={validators.composeAsync(
                  validators.required,
                  nameValidator.validate,
                )}
                validateFields={['name']}
                errors={{
                  required: 'Enter a package name',
                  invalid: 'Invalid package name',
                }}
                margin="normal"
                fullWidth
                initialValue={initialName}
              />

              <RF.Field
                component={PD.Field}
                name="commitMessage"
                label="Commit message"
                placeholder="Enter a commit message"
                validate={validators.required}
                validateFields={['commitMessage']}
                errors={{
                  required: 'Enter a commit message',
                }}
                fullWidth
                margin="normal"
              />

              <PD.SchemaFetcher
                schemaUrl={R.pathOr('', ['schema', 'url'], values.workflow)}
              >
                {AsyncResult.case({
                  Ok: ({ responseError, schema, validate }) => (
                    <RF.Field
                      component={PD.MetaInput}
                      name="meta"
                      bucket={successor.slug}
                      schema={schema}
                      schemaError={responseError}
                      validate={validate}
                      validateFields={['meta']}
                      isEqual={R.equals}
                      initialValue={initialMeta}
                    />
                  ),
                  _: () => <PD.MetaInputSkeleton />,
                })}
              </PD.SchemaFetcher>

              <RF.Field
                component={PD.WorkflowInput}
                name="workflow"
                workflowsConfig={workflowsConfig}
                initialValue={PD.defaultWorkflowFromConfig(workflowsConfig)}
                validateFields={['meta', 'workflow']}
              />

              <input type="submit" style={{ display: 'none' }} />
            </form>
          </M.DialogContent>
          <M.DialogActions>
            {submitting && (
              <Delay ms={200} alwaysRender>
                {(ready) => (
                  <M.Fade in={ready}>
                    <M.Box flexGrow={1} display="flex" alignItems="center" pl={2}>
                      <M.CircularProgress size={24} variant="indeterminate" />
                      <M.Box pl={1} />
                      <M.Typography variant="body2" color="textSecondary">
                        {successor.copyData
                          ? 'Copying files and writing manifest'
                          : 'Writing manifest'}
                      </M.Typography>
                    </M.Box>
                  </M.Fade>
                )}
              </Delay>
            )}

            {!submitting && (!!error || !!submitError) && (
              <M.Box flexGrow={1} display="flex" alignItems="center" pl={2}>
                <M.Icon color="error">error_outline</M.Icon>
                <M.Box pl={1} />
                <M.Typography variant="body2" color="error">
                  {error || submitError}
                </M.Typography>
              </M.Box>
            )}

            <M.Button onClick={close} disabled={submitting}>
              Cancel
            </M.Button>
            <M.Button
              onClick={handleSubmit}
              variant="contained"
              color="primary"
              disabled={submitting || (submitFailed && hasValidationErrors)}
            >
              Push
            </M.Button>
          </M.DialogActions>
        </>
      )}
    </RF.Form>
  )
}

function DialogError({ bucket, error, onCancel }) {
  const { urls } = NamedRoutes.use()

  return (
    <PD.DialogError
      error={error}
      skeletonElement={<FormSkeleton animate={false} />}
      title={
        <>
          Push package to{' '}
          <StyledLink target="_blank" to={urls.bucketOverview(bucket)}>
            {bucket}
          </StyledLink>{' '}
          bucket
        </>
      }
      onCancel={onCancel}
    />
  )
}

function DialogLoading({ bucket, onCancel }) {
  const { urls } = NamedRoutes.use()

  return (
    <PD.DialogLoading
      skeletonElement={<FormSkeleton animate={false} />}
      title={
        <>
          Push package to{' '}
          <StyledLink target="_blank" to={urls.bucketOverview(bucket)}>
            {bucket}
          </StyledLink>{' '}
          bucket
        </>
      }
      onCancel={onCancel}
    />
  )
}

const DialogState = tagged(['Loading', 'Error', 'Form', 'Success'])

export default function PackageCopyDialog({
  open,
  bucket,
  successor,
  name,
  hash,
  onExited,
  onClose,
}) {
  const s3 = AWS.S3.use()

  const [success, setSuccess] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)

  const manifestData = Data.use(
    requests.loadManifest,
    {
      s3,
      bucket,
      name,
      hash,
    },
    { noAutoFetch: !successor || !open },
  )

  const workflowsData = Data.use(
    requests.workflowsList,
    { s3, bucket: successor ? successor.slug : '' },
    { noAutoFetch: !successor || !open },
  )

  const state = React.useMemo(() => {
    if (success) return DialogState.Success(success)
    return workflowsData.case({
      Ok: (workflowsConfig) =>
        manifestData.case({
          Ok: (manifest) => DialogState.Form({ manifest, workflowsConfig }),
          Err: DialogState.Error,
          _: DialogState.Loading,
        }),
      Err: DialogState.Error,
      _: DialogState.Loading,
    })
  }, [success, workflowsData, manifestData])

  const stateCase = React.useCallback((cases) => DialogState.case(cases, state), [state])

  const handleSuccess = React.useCallback(
    (successData) => {
      setSuccess(successData)
    },
    [setSuccess],
  )

  const handleExited = React.useCallback(() => {
    if (submitting) return

    onExited({
      pushed: success,
    })
    if (onClose) onClose()
    setSuccess(null)
  }, [submitting, success, setSuccess, onClose, onExited])

  const handleClose = React.useCallback(() => {
    if (submitting) return

    onExited({
      pushed: success,
    })
    if (onClose) onClose()
    setSuccess(null)
  }, [submitting, success, setSuccess, onClose, onExited])

  return (
    <M.Dialog
      open={open}
      onClose={handleClose}
      fullWidth
      scroll="body"
      onExited={handleExited}
    >
      {stateCase({
        Error: (e) =>
          successor && (
            <DialogError bucket={successor.slug} onCancel={handleClose} error={e} />
          ),
        Loading: () =>
          successor && <DialogLoading bucket={successor.slug} onCancel={handleClose} />,
        Form: (props) =>
          successor && (
            <DialogForm
              {...{
                bucket,
                hash,
                name,
                successor,
                close: handleClose,
                onSubmitStart: () => setSubmitting(true),
                onSubmitEnd: () => setSubmitting(false),
                onSuccess: handleSuccess,
                ...props,
              }}
            />
          ),
        Success: (props) =>
          successor && (
            <PD.DialogSuccess
              bucket={successor.slug}
              name={props.name}
              hash={props.hash}
              onClose={handleClose}
            />
          ),
      })}
    </M.Dialog>
  )
}
