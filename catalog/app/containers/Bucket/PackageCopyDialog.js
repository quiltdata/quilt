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

const useFormSkeletonStyles = M.makeStyles((t) => ({
  meta: {
    marginTop: t.spacing(3),
  },
}))

function FormSkeleton({ animate }) {
  const classes = useFormSkeletonStyles()

  return (
    <>
      <PD.TextFieldSkeleton animate={animate} />
      <PD.TextFieldSkeleton animate={animate} />

      <PD.MetaInputSkeleton className={classes.meta} animate={animate} />
      <PD.WorkflowsInputSkeleton animate={animate} />
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

const defaultNameWarning = ' ' // Reserve space for warning

const useStyles = M.makeStyles((t) => ({
  meta: {
    marginTop: t.spacing(3),
  },
}))

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
  const nameExistence = PD.useNameExistence(successor.slug)
  const [nameWarning, setNameWarning] = React.useState('')
  const classes = useStyles()

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

  const onFormChange = React.useCallback(
    async ({ values }) => {
      const { name } = values
      const fullName = `${successor.slug}/${name}`

      let warning = defaultNameWarning

      const nameExists = await nameExistence.validate(name)
      if (nameExists) {
        warning = `Package "${fullName}" exists. Submitting will revise it`
      } else if (name) {
        warning = `Package "${fullName}" will be created`
      }

      if (warning !== nameWarning) {
        setNameWarning(warning)
      }
    },
    [successor, nameExistence, nameWarning],
  )

  const initialWorkflow = React.useMemo(
    () => PD.defaultWorkflowFromConfig(workflowsConfig),
    [workflowsConfig],
  )

  const [workflow, setWorkflow] = React.useState(initialWorkflow)

  return (
    <RF.Form
      onSubmit={onSubmit}
      subscription={{
        handleSubmit: true,
        submitting: true,
        submitFailed: true,
        error: true,
        submitError: true,
        hasValidationErrors: true,
        form: true,
      }}
    >
      {({
        handleSubmit,
        submitting,
        submitFailed,
        error,
        submitError,
        hasValidationErrors,
        form,
      }) => (
        <>
          <DialogTitle bucket={successor.slug} />
          <M.DialogContent style={{ paddingTop: 0 }}>
            <form onSubmit={handleSubmit}>
              <RF.FormSpy subscription={{ values: true }} onChange={onFormChange} />

              <RF.FormSpy
                subscription={{ modified: true, values: true }}
                onChange={({ modified, values }) => {
                  if (modified.workflow) {
                    setWorkflow(values.workflow)
                  }
                }}
              />

              <RF.Field
                component={PD.PackageNameInput}
                name="name"
                validate={validators.composeAsync(
                  validators.required,
                  nameValidator.validate,
                )}
                validateFields={['name']}
                errors={{
                  required: 'Enter a package name',
                  invalid: 'Invalid package name',
                }}
                helperText={nameWarning}
                initialValue={initialName}
              />

              <RF.Field
                component={PD.CommitMessageInput}
                name="commitMessage"
                validate={validators.required}
                validateFields={['commitMessage']}
                errors={{
                  required: 'Enter a commit message',
                }}
              />

              <PD.SchemaFetcher schemaUrl={R.pathOr('', ['schema', 'url'], workflow)}>
                {AsyncResult.case({
                  Ok: ({ responseError, schema, validate }) => (
                    <RF.Field
                      className={classes.meta}
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
                  _: () => <PD.MetaInputSkeleton className={classes.meta} />,
                })}
              </PD.SchemaFetcher>

              <RF.Field
                component={PD.WorkflowInput}
                name="workflow"
                workflowsConfig={workflowsConfig}
                initialValue={initialWorkflow}
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
      skeletonElement={<FormSkeleton />}
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
      fullWidth
      onClose={handleClose}
      onExited={handleExited}
      open={open}
      scroll="body"
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
