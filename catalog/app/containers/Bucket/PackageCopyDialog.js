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

async function requestPackageCopy(
  req,
  {
    commitMessage,
    copyData,
    hash,
    initialName,
    meta,
    name,
    sourceBucket,
    targetBucket,
    workflow,
  },
) {
  try {
    return req({
      endpoint: '/packages/promote',
      method: 'POST',
      body: {
        copy_data: copyData,
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
  } catch (e) {
    return { [FORM_ERROR]: e.message || PD.ERROR_MESSAGES.MANIFEST }
  }
}

const useCopyDataSwitcherStyles = M.makeStyles((t) => ({
  root: {
    marginTop: t.spacing(2),
  },
}))

function CopyDataSwitcher({ input: { onChange, value }, targetBucket, sourceBucket }) {
  const classes = useCopyDataSwitcherStyles()

  const handleChange = React.useCallback((event) => onChange(event.target.checked), [
    onChange,
  ])

  return (
    <div className={classes.root}>
      <M.FormControlLabel
        control={<M.Switch color="primary" checked={value} onChange={handleChange} />}
        label={
          value
            ? `Files will be copied from "${sourceBucket}" to "${targetBucket}"`
            : `Files will persist in "${sourceBucket}", but links will be copied`
        }
        labelPlacement="end"
      />
    </div>
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

const useDialogFormStyles = M.makeStyles(() => ({
  filesWrapper: {
    position: 'relative',
  },
}))

function DialogForm({
  close,
  hash,
  manifest,
  name: initialName,
  onSuccess,
  sourceBucket,
  targetBucket,
  workflowsConfig,
}) {
  const classes = useDialogFormStyles()

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
  const onSubmit = async ({ commitMessage, copyData, name, meta, workflow }) => {
    try {
      const res = await requestPackageCopy(req, {
        commitMessage,
        copyData,
        hash,
        initialName,
        meta,
        name,
        sourceBucket,
        targetBucket,
        workflow,
      })
      onSuccess({ name, hash: res.top_hash })
    } catch (e) {
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
          <DialogTitle bucket={targetBucket} />
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

              <RF.Field
                className={classes.filesSwitcher}
                component={CopyDataSwitcher}
                initialValue={false}
                name="copyData"
                sourceBucket={sourceBucket}
                targetBucket={targetBucket}
                validateFields={['copyData']}
              />

              <PD.SchemaFetcher
                schemaUrl={R.pathOr('', ['schema', 'url'], values.workflow)}
              >
                {AsyncResult.case({
                  Ok: ({ responseError, schema, validate }) => (
                    <RF.Field
                      component={PD.MetaInput}
                      name="meta"
                      bucket={targetBucket}
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
                        {values.copyData
                          ? 'Copying files and writing manfest'
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
  sourceBucket,
  targetBucket,
  name,
  hash,
  onExited,
  onClose,
}) {
  const s3 = AWS.S3.use()

  const [success, setSuccess] = React.useState(false)

  const manifestData = Data.use(requests.loadManifest, {
    s3,
    bucket: sourceBucket,
    name,
    hash,
  })

  const workflowsData = Data.use(requests.workflowsList, { s3, bucket: targetBucket })

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
    onExited({
      pushed: success,
    })
    onClose()
  }, [onExited, onClose, success])

  const handleClose = React.useCallback(() => {
    onExited({
      pushed: success,
    })
    onClose()
  }, [onExited, success, onClose])

  return (
    <M.Dialog open onClose={onClose} fullWidth scroll="body" onExited={handleExited}>
      {stateCase({
        Error: (e) => <DialogError bucket={targetBucket} onClose={onClose} error={e} />,
        Loading: () => <DialogLoading bucket={targetBucket} onCancel={onClose} />,
        Form: (props) => (
          <DialogForm
            {...{
              close: onClose,
              hash,
              name,
              onSuccess: handleSuccess,
              sourceBucket,
              targetBucket,
              ...props,
            }}
          />
        ),
        Success: (props) => (
          <PD.DialogSuccess
            bucket={targetBucket}
            name={props.name}
            hash={props.hash}
            onClose={handleClose}
          />
        ),
      })}
    </M.Dialog>
  )
}
