import { basename } from 'path'
import * as R from 'ramda'
import * as React from 'react'
import * as RF from 'react-final-form'
import * as M from '@material-ui/core'

import AsyncResult from 'utils/AsyncResult'
import * as AWS from 'utils/AWS'
import * as Data from 'utils/Data'
import Delay from 'utils/Delay'
import * as NamedRoutes from 'utils/NamedRoutes'
import StyledLink from 'utils/StyledLink'
import * as validators from 'utils/validators'

import * as PD from './PackageDialog'
import * as requests from './requests'

const useDialogTitleStyles = M.makeStyles((t) => ({
  directory: {
    background: t.palette.grey[300],
    borderRadius: '2px',
    color: t.palette.text.primary,
    fontFamily: t.typography.monospace.fontFamily,
    fontSize: '1.15rem',
    padding: '0 3px',
    whiteSpace: 'pre-wrap',
  },
}))

function DialogTitle({ bucket, path }) {
  const { urls } = NamedRoutes.use()
  const classes = useDialogTitleStyles()

  return (
    <M.DialogTitle>
      Push <code className={classes.directory}>{path}</code> directory to{' '}
      <StyledLink target="_blank" to={urls.bucketOverview(bucket)}>
        {bucket}
      </StyledLink>{' '}
      bucket as package
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
  files,
  path,
  successor,
  onSubmitStart,
  onSubmitEnd,
  workflowsConfig,
}) {
  const nameValidator = PD.useNameValidator()
  const nameExistence = PD.useNameExistence(successor.slug)
  const [nameWarning, setNameWarning] = React.useState('')
  // const [uploads, setUploads] = React.useState({})
  const classes = useStyles()

  const onSubmit = React.useCallback(async () => {
    onSubmitStart()
    onSubmitEnd()
  }, [onSubmitStart, onSubmitEnd])

  const onFilesAction = () => {}

  const initialFiles = {
    existing: files.reduce(
      (memo, file) => ({
        [basename(file.key)]: {
          size: file.size,
        },
        ...memo,
      }),
      {},
    ),
    added: {},
    deleted: {},
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

  const initialName = React.useMemo(() => '', [])

  const initialWorkflow = React.useMemo(
    () => PD.defaultWorkflowFromConfig(workflowsConfig),
    [workflowsConfig],
  )

  const [workflow, setWorkflow] = React.useState(initialWorkflow)

  const uploads = [{}]

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
      }) => (
        <>
          <DialogTitle bucket={successor.slug} path={path} />
          <M.DialogContent style={{ paddingTop: 0 }}>
            <form onSubmit={handleSubmit}>
              <RF.FormSpy
                subscription={{ dirtyFields: true, values: true }}
                onChange={onFormChange}
              />

              <RF.FormSpy
                subscription={{ modified: true, values: true }}
                onChange={({ modified, values }) => {
                  if (modified.workflow && values.workflow !== workflow) {
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
                          initialValue={PD.EMPTY_META_VALUE}
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
                    validate={validators.nonEmpty}
                    validateFields={['files']}
                    errors={{
                      nonEmpty: 'Add files to create a package',
                    }}
                    uploads={uploads}
                    onFilesAction={onFilesAction}
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

  // FIXME: edit text
  return (
    <PD.DialogError
      error={error}
      skeletonElement={<PD.FormSkeleton animate={false} />}
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

  // FIXME: edit text
  return (
    <PD.DialogLoading
      skeletonElement={<PD.FormSkeleton />}
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

export default function PackageDirectoryDialog({
  files,
  onClose,
  onExited,
  open,
  path,
  successor,
}) {
  const s3 = AWS.S3.use()

  const [success, setSuccess] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)

  const workflowsData = Data.use(
    requests.workflowsList,
    { s3, bucket: successor ? successor.slug : '' },
    { noAutoFetch: !successor || !open },
  )

  const handleSuccess = React.useCallback(
    (successData) => {
      setSuccess(successData)
    },
    [setSuccess],
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
      {workflowsData.case({
        Err: (e) =>
          successor && (
            <DialogError bucket={successor.slug} onCancel={handleClose} error={e} />
          ),
        Ok: (workflowsConfig) =>
          successor && (
            <DialogForm
              {...{
                close: handleClose,
                files,
                onSubmitEnd: () => setSubmitting(false),
                onSubmitStart: () => setSubmitting(true),
                onSuccess: handleSuccess,
                path,
                successor,
                workflowsConfig,
              }}
            />
          ),
        _: () =>
          successor && <DialogLoading bucket={successor.slug} onCancel={handleClose} />,
      })}
    </M.Dialog>
  )
}
