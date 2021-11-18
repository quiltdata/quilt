import { FORM_ERROR } from 'final-form'
import * as R from 'ramda'
import * as React from 'react'
import * as RF from 'react-final-form'
import * as M from '@material-ui/core'

import * as Intercom from 'components/Intercom'
import * as AWS from 'utils/AWS'
import * as Data from 'utils/Data'
import * as NamedRoutes from 'utils/NamedRoutes'
import StyledLink from 'utils/StyledLink'
import tagged from 'utils/tagged'
import * as validators from 'utils/validators'

import * as PD from './PackageDialog'
import * as requests from './requests'

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

const useStyles = M.makeStyles((t) => ({
  form: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflowY: 'auto',
  },
  meta: {
    display: 'flex',
    flexDirection: 'column',
    paddingTop: t.spacing(3),
    overflowY: 'auto',
  },
}))

function DialogForm({
  bucket,
  close,
  hash,
  manifest,
  name: initialName,
  responseError,
  schema,
  schemaLoading,
  selectedWorkflow,
  setSubmitting,
  setSuccess,
  setWorkflow,
  successor,
  validate: validateMetaInput,
  workflowsConfig,
}) {
  const nameValidator = PD.useNameValidator(selectedWorkflow)
  const nameExistence = PD.useNameExistence(successor.slug)
  const [nameWarning, setNameWarning] = React.useState('')
  const [metaHeight, setMetaHeight] = React.useState(0)
  const classes = useStyles()
  const validateWorkflow = PD.useWorkflowValidator(workflowsConfig)

  const copyPackage = requests.useCopyPackage()

  // eslint-disable-next-line consistent-return
  const onSubmit = async ({ commitMessage, name, meta, workflow }) => {
    try {
      const res = await copyPackage(
        {
          message: commitMessage,
          meta,
          source: {
            bucket,
            name: initialName,
            revision: hash,
          },
          target: {
            bucket: successor.slug,
            name,
          },
          workflow,
        },
        schema,
      )
      setSuccess({ name, hash: res.top_hash })
    } catch (e) {
      // eslint-disable-next-line no-console
      console.log('error creating manifest', e)
      return { [FORM_ERROR]: e.message || PD.ERROR_MESSAGES.MANIFEST }
    }
  }

  const onSubmitWrapped = async (...args) => {
    setSubmitting(true)
    try {
      return await onSubmit(...args)
    } finally {
      setSubmitting(false)
    }
  }

  const handleNameChange = React.useCallback(
    async (name) => {
      const nameExists = await nameExistence.validate(name)
      const warning = <PD.PackageNameWarning exists={!!nameExists} />

      if (warning !== nameWarning) {
        setNameWarning(warning)
      }
    },
    [nameWarning, nameExistence],
  )

  const [editorElement, setEditorElement] = React.useState()
  const resizeObserver = React.useMemo(
    () =>
      new window.ResizeObserver((entries) => {
        const { height } = entries[0].contentRect
        setMetaHeight(height)
      }),
    [setMetaHeight],
  )

  // HACK: FIXME: it triggers name validation with correct workflow
  const [hideMeta, setHideMeta] = React.useState(false)

  const onFormChange = React.useCallback(
    async ({ modified, values }) => {
      if (modified.workflow && values.workflow !== selectedWorkflow) {
        setWorkflow(values.workflow)

        // HACK: FIXME: it triggers name validation with correct workflow
        setHideMeta(true)
        setTimeout(() => {
          setHideMeta(false)
        }, 300)
      }

      handleNameChange(values.name)
    },
    [handleNameChange, selectedWorkflow, setWorkflow],
  )

  React.useEffect(() => {
    if (editorElement) resizeObserver.observe(editorElement)
    return () => {
      if (editorElement) resizeObserver.unobserve(editorElement)
    }
  }, [editorElement, resizeObserver])

  const dialogContentClasses = PD.useContentStyles({ metaHeight })

  return (
    <RF.Form
      onSubmit={onSubmitWrapped}
      subscription={{
        error: true,
        hasValidationErrors: true,
        submitError: true,
        submitFailed: true,
        submitting: true,
      }}
    >
      {({
        error,
        hasValidationErrors,
        submitError,
        submitFailed,
        submitting,
        handleSubmit,
      }) => (
        <>
          <DialogTitle bucket={successor.slug} />
          <M.DialogContent classes={dialogContentClasses}>
            <form onSubmit={handleSubmit} className={classes.form}>
              <RF.FormSpy
                subscription={{ modified: true, values: true }}
                onChange={onFormChange}
              />

              <RF.FormSpy
                subscription={{ modified: true, values: true }}
                onChange={({ modified, values }) => {
                  if (modified.workflow) {
                    setWorkflow(values.workflow)
                  }
                }}
              />

              <RF.Field
                component={PD.WorkflowInput}
                name="workflow"
                workflowsConfig={workflowsConfig}
                initialValue={selectedWorkflow}
                validate={validateWorkflow}
                validateFields={['meta', 'workflow']}
                errors={{
                  required: 'Workflow is required for this bucket.',
                }}
              />

              <RF.Field
                component={PD.PackageNameInput}
                name="name"
                workflow={selectedWorkflow || workflowsConfig}
                validate={validators.composeAsync(
                  validators.required,
                  nameValidator.validate,
                )}
                validateFields={['name']}
                errors={{
                  required: 'Enter a package name',
                  invalid: 'Invalid package name',
                  pattern: `Name should match ${selectedWorkflow?.packageNamePattern}`,
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

              {schemaLoading || hideMeta ? (
                <PD.MetaInputSkeleton className={classes.meta} ref={setEditorElement} />
              ) : (
                <RF.Field
                  className={classes.meta}
                  component={PD.MetaInput}
                  name="meta"
                  bucket={successor.slug}
                  schema={schema}
                  schemaError={responseError}
                  validate={validateMetaInput}
                  validateFields={['meta']}
                  isEqual={R.equals}
                  ref={setEditorElement}
                  initialValue={manifest.meta}
                />
              )}

              <input type="submit" style={{ display: 'none' }} />
            </form>
          </M.DialogContent>
          <M.DialogActions>
            {submitting && (
              <PD.SubmitSpinner>
                {successor.copyData
                  ? 'Copying files and writing manifest'
                  : 'Writing manifest'}
              </PD.SubmitSpinner>
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

  const [workflow, setWorkflow] = React.useState(null)

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
    requests.workflowsConfig,
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

  const handleExited = React.useCallback(() => {
    if (submitting) return

    onExited({
      pushed: success,
    })
    if (onClose) onClose()
    setSuccess(null)
  }, [submitting, success, setSuccess, onClose, onExited])

  const close = React.useCallback(() => {
    if (submitting) return

    onExited({
      pushed: success,
    })
    if (onClose) onClose()
    setSuccess(null)
  }, [submitting, success, setSuccess, onClose, onExited])

  Intercom.usePauseVisibilityWhen(open)

  return (
    <M.Dialog fullWidth onClose={close} onExited={handleExited} open={open} scroll="body">
      {stateCase({
        Error: (e) =>
          successor && <DialogError bucket={successor.slug} onCancel={close} error={e} />,
        Loading: () =>
          successor && <DialogLoading bucket={successor.slug} onCancel={close} />,
        Form: ({ manifest, workflowsConfig }) =>
          successor && (
            <PD.SchemaFetcher
              manifest={manifest}
              workflowsConfig={workflowsConfig}
              workflow={workflow}
            >
              {(schemaProps) => (
                <DialogForm
                  {...schemaProps}
                  {...{
                    bucket,
                    close,
                    setSubmitting,
                    setSuccess,
                    setWorkflow,
                    workflowsConfig,

                    hash,
                    manifest,
                    name,
                    successor,
                  }}
                />
              )}
            </PD.SchemaFetcher>
          ),
        Success: (props) =>
          successor && (
            <PD.DialogSuccess
              bucket={successor.slug}
              name={props.name}
              hash={props.hash}
              onClose={close}
            />
          ),
      })}
    </M.Dialog>
  )
}
