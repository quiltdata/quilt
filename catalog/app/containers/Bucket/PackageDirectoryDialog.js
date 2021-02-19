import { FORM_ERROR } from 'final-form'
import { basename } from 'path'
import * as R from 'ramda'
import * as React from 'react'
import * as RF from 'react-final-form'
import * as M from '@material-ui/core'

import Code from 'components/Code'
import * as APIConnector from 'utils/APIConnector'
import AsyncResult from 'utils/AsyncResult'
import * as AWS from 'utils/AWS'
import * as Data from 'utils/Data'
import * as NamedRoutes from 'utils/NamedRoutes'
import StyledLink from 'utils/StyledLink'
import * as validators from 'utils/validators'

import * as PD from './PackageDialog'
import * as requests from './requests'

function requestPackageCreate(
  req,
  { commitMessage, name, meta, sourceBucket, path, schema, targetBucket, workflow },
) {
  return req({
    endpoint: '/packages/from-folder',
    method: 'POST',
    body: {
      message: commitMessage,
      meta: PD.getMetaValue(meta, schema),
      path,
      dst: {
        registry: `s3://${targetBucket}`,
        name,
      },
      registry: `s3://${sourceBucket}`,
      workflow: PD.getWorkflowApiParam(workflow.slug),
    },
  })
}

function DialogTitle({ bucket, path }) {
  const { urls } = NamedRoutes.use()

  const directory = path ? `"${path}"` : 'root'

  return (
    <>
      Push {directory} directory to{' '}
      <StyledLink target="_blank" to={urls.bucketOverview(bucket)}>
        {bucket}
      </StyledLink>{' '}
      bucket as package
    </>
  )
}

const useStyles = M.makeStyles((t) => ({
  files: {
    height: '100%',
  },
  form: {
    height: '100%',
  },
  meta: {
    display: 'flex',
    flexDirection: 'column',
    marginTop: t.spacing(3),
    overflowY: 'auto',
  },
}))

function DialogForm({
  bucket,
  close,
  files,
  path,
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
  const nameValidator = PD.useNameValidator()
  const nameExistence = PD.useNameExistence(successor.slug)
  const [nameWarning, setNameWarning] = React.useState('')
  const [metaHeight, setMetaHeight] = React.useState(0)
  const classes = useStyles()

  const req = APIConnector.use()

  const dialogContentClasses = PD.useContentStyles({ metaHeight })

  const onSubmit = React.useCallback(
    // eslint-disable-next-line consistent-return
    async ({ commitMessage, name, meta, workflow }) => {
      try {
        const res = await requestPackageCreate(req, {
          commitMessage,
          meta,
          name,
          path,
          schema,
          sourceBucket: bucket,
          targetBucket: successor.slug,
          workflow,
        })
        setSuccess({ name, hash: res.top_hash })
      } catch (e) {
        // eslint-disable-next-line no-console
        console.log('error creating manifest', e)
        return { [FORM_ERROR]: e.message || PD.ERROR_MESSAGES.MANIFEST }
      }
    },
    [bucket, successor, req, setSuccess, schema, path],
  )

  const initialFiles = React.useMemo(
    () => ({
      existing: files.reduce(
        (memo, file) => ({
          [basename(file.key)]: {
            isDir: file.isDir,
            size: file.size,
          },
          ...memo,
        }),
        {},
      ),
      added: {},
      deleted: {},
    }),
    [files],
  )

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
      const fullName = `${successor.slug}/${name}`

      let warning = ''

      const nameExists = await nameExistence.validate(name)
      if (nameExists) {
        warning = (
          <>
            <Code>{fullName}</Code> already exists. Click Push to create a new revision.
          </>
        )
      } else if (name) {
        warning = (
          <>
            <Code>{fullName}</Code> is a new package
          </>
        )
      }

      if (warning !== nameWarning) {
        setNameWarning(warning)
      }
    },
    [nameWarning, nameExistence, successor],
  )

  const [editorElement, setEditorElement] = React.useState()

  const onFormChange = React.useCallback(
    async ({ values }) => {
      if (document.body.contains(editorElement)) {
        setMetaHeight(editorElement.clientHeight)
      }

      handleNameChange(values.name)
    },
    [editorElement, handleNameChange, setMetaHeight],
  )

  React.useEffect(() => {
    if (document.body.contains(editorElement)) {
      setMetaHeight(editorElement.clientHeight)
    }
  }, [editorElement, setMetaHeight])

  return (
    <RF.Form
      onSubmit={onSubmitWrapped}
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
      }) => (
        <>
          <M.DialogTitle>
            <DialogTitle bucket={successor.slug} path={path} />
          </M.DialogTitle>

          <M.DialogContent classes={dialogContentClasses}>
            <form onSubmit={handleSubmit} className={classes.form}>
              <RF.FormSpy
                subscription={{ dirtyFields: true, values: true }}
                onChange={onFormChange}
              />

              <RF.FormSpy
                subscription={{ modified: true, values: true }}
                onChange={({ modified, values }) => {
                  if (modified.workflow && values.workflow !== selectedWorkflow) {
                    setWorkflow(values.workflow)
                  }
                }}
              />

              <PD.Container>
                <PD.LeftColumn>
                  <M.Typography color={submitting ? 'textSecondary' : undefined}>
                    Main
                  </M.Typography>

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

                  {schemaLoading ? (
                    <PD.MetaInputSkeleton
                      className={classes.meta}
                      ref={setEditorElement}
                    />
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
                      initialValue={PD.EMPTY_META_VALUE}
                      ref={setEditorElement}
                    />
                  )}

                  <RF.Field
                    component={PD.WorkflowInput}
                    name="workflow"
                    workflowsConfig={workflowsConfig}
                    initialValue={selectedWorkflow}
                    validate={validators.required}
                    validateFields={['meta', 'workflow']}
                    errors={{
                      required: 'Workflow is required for this bucket.',
                    }}
                  />
                </PD.LeftColumn>

                <PD.RightColumn>
                  <RF.Field
                    className={classes.files}
                    component={PD.FilesInput}
                    name="files"
                    totalProgress={{}}
                    validate={validators.nonEmpty}
                    validateFields={['files']}
                    errors={{
                      nonEmpty: 'Add files to create a package',
                    }}
                    disabled
                    title="Files and directories below will be packaged"
                    onFilesAction={R.T}
                    isEqual={R.equals}
                    initialValue={initialFiles}
                  />
                </PD.RightColumn>
              </PD.Container>

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

function DialogError({ bucket, error, path, onCancel }) {
  return (
    <PD.DialogError
      error={error}
      skeletonElement={<PD.FormSkeleton animate={false} />}
      title={<DialogTitle bucket={bucket} path={path} />}
      onCancel={onCancel}
    />
  )
}

function DialogLoading({ bucket, path, onCancel }) {
  return (
    <PD.DialogLoading
      skeletonElement={<PD.FormSkeleton />}
      title={<DialogTitle bucket={bucket} path={path} />}
      onCancel={onCancel}
    />
  )
}

export default function PackageDirectoryDialog({
  bucket,
  files,
  onClose,
  onExited,
  open,
  path,
  successor,
}) {
  const s3 = AWS.S3.use()

  const [workflow, setWorkflow] = React.useState(null)
  const [success, setSuccess] = React.useState(null)
  const [submitting, setSubmitting] = React.useState(false)

  const workflowsData = Data.use(
    requests.workflowsList,
    { s3, bucket: successor ? successor.slug : '' },
    { noAutoFetch: !successor || !open },
  )

  const handleClose = React.useCallback(() => {
    if (submitting) return

    onExited({
      pushed: success,
    })
    if (onClose) onClose()
    setSuccess(null)
  }, [submitting, success, setSuccess, onClose, onExited])

  const handleExited = React.useCallback(() => {
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
      maxWidth={success ? 'sm' : 'lg'}
      onClose={handleClose}
      onExited={handleExited}
      open={open}
      scroll="body"
    >
      {success && successor ? (
        <PD.DialogSuccess
          bucket={successor.slug}
          name={success.name}
          hash={success.hash}
          onClose={handleClose}
        />
      ) : (
        workflowsData.case({
          Err: (e) =>
            successor && (
              <DialogError
                bucket={successor.slug}
                path={path}
                onCancel={handleClose}
                error={e}
              />
            ),
          Ok: (workflowsConfig) =>
            successor && (
              <PD.SchemaFetcher workflow={workflow} workflowsConfig={workflowsConfig}>
                {AsyncResult.case({
                  Ok: (schemaProps) => (
                    <DialogForm
                      {...schemaProps}
                      {...{
                        bucket,
                        close: handleClose,
                        files,
                        path,
                        setSubmitting,
                        setSuccess,
                        setWorkflow,
                        successor,
                        workflowsConfig,
                      }}
                    />
                  ),
                  _: R.identity,
                })}
              </PD.SchemaFetcher>
            ),
          _: () =>
            successor && (
              <DialogLoading bucket={successor.slug} path={path} onCancel={handleClose} />
            ),
        })
      )}
    </M.Dialog>
  )
}
