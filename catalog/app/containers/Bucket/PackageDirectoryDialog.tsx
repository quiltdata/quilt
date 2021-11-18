import * as FF from 'final-form'
import { basename } from 'path'
import * as R from 'ramda'
import * as React from 'react'
import * as RF from 'react-final-form'
import * as M from '@material-ui/core'

import * as Intercom from 'components/Intercom'
import * as AWS from 'utils/AWS'
import * as Data from 'utils/Data'
import * as NamedRoutes from 'utils/NamedRoutes'
import StyledLink from 'utils/StyledLink'
import * as validators from 'utils/validators'
import type * as workflows from 'utils/workflows'

import * as PD from './PackageDialog'
import * as requests from './requests'

const prepareEntries = (entries: PD.FilesSelectorState, path: string) => {
  const selected = entries.filter(R.propEq('selected', true))
  if (selected.length === entries.length)
    return [{ logical_key: '.', path, is_dir: true }]
  return selected.map(({ type, name }) => ({
    logical_key: name,
    path: path + name,
    is_dir: type === 'dir',
  }))
}

interface DialogTitleProps {
  bucket: string
  path?: string
}

function DialogTitle({ bucket, path }: DialogTitleProps) {
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
    paddingTop: t.spacing(3),
    overflowY: 'auto',
  },
}))

interface DialogFormProps {
  bucket: string
  path: string
  truncated?: boolean
  dirs: string[]
  files: { key: string; size: number }[]
  close: () => void
  setSubmitting: (submitting: boolean) => void
  setSuccess: (success: { name: string; hash: string }) => void
  setWorkflow: (workflow: workflows.Workflow) => void
  successor: workflows.Successor
  workflowsConfig: workflows.WorkflowsConfig
}

function DialogForm({
  bucket,
  path,
  truncated,
  dirs,
  files,
  close,
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
}: DialogFormProps & PD.SchemaFetcherRenderProps) {
  const nameValidator = PD.useNameValidator(selectedWorkflow)
  const nameExistence = PD.useNameExistence(successor.slug)
  const [nameWarning, setNameWarning] = React.useState<React.ReactNode>('')
  const [metaHeight, setMetaHeight] = React.useState(0)
  const validateWorkflow = PD.useWorkflowValidator(workflowsConfig)
  const classes = useStyles()

  const createPackage = requests.useWrapPackage()

  const dialogContentClasses = PD.useContentStyles({ metaHeight })

  const onSubmit = React.useCallback(
    async ({
      commitMessage: message,
      files: filesValue,
      ...values
    }: {
      commitMessage: string
      name: string
      meta: object
      workflow: workflows.Workflow
      files: PD.FilesSelectorState
      // eslint-disable-next-line consistent-return
    }) => {
      try {
        const res = await createPackage(
          {
            ...values,
            entries: prepareEntries(filesValue, path),
            message,
            source: bucket,
            target: {
              bucket: successor.slug,
              name: values.name,
            },
          },
          schema,
        )
        setSuccess({ name: values.name, hash: res.top_hash })
      } catch (e) {
        // eslint-disable-next-line no-console
        console.log('error creating manifest', e)
        const errorMessage = e instanceof Error ? e.message : null
        return { [FF.FORM_ERROR]: errorMessage || PD.ERROR_MESSAGES.MANIFEST }
      }
    },
    [bucket, successor, createPackage, setSuccess, schema, path],
  )

  const initialFiles: PD.FilesSelectorState = React.useMemo(
    () => [
      ...dirs.map((dir) => ({
        type: 'dir' as const,
        name: basename(dir),
        selected: false,
      })),
      ...files.map((file) => ({
        type: 'file' as const,
        name: basename(file.key),
        size: file.size,
        selected: false,
      })),
    ],
    [dirs, files],
  )

  const onSubmitWrapped = async (...args: Parameters<typeof onSubmit>) => {
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

  const [editorElement, setEditorElement] = React.useState<HTMLElement | null>(null)
  const resizeObserver = React.useMemo(
    () =>
      new window.ResizeObserver((entries) => {
        const { height } = entries[0]!.contentRect
        setMetaHeight(height)
      }),
    [setMetaHeight],
  )
  const onFormChange = React.useCallback(
    async ({ values }) => {
      handleNameChange(values.name)
    },
    [handleNameChange],
  )

  React.useEffect(() => {
    if (editorElement) resizeObserver.observe(editorElement)
    return () => {
      if (editorElement) resizeObserver.unobserve(editorElement)
    }
  }, [editorElement, resizeObserver])

  // HACK: FIXME: it triggers name validation with correct workflow
  const [hideMeta, setHideMeta] = React.useState(false)

  return (
    <RF.Form
      onSubmit={onSubmitWrapped}
      subscription={{
        submitting: true,
        submitFailed: true,
        error: true,
        submitError: true,
        hasValidationErrors: true,
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
                  if (modified?.workflow && values.workflow !== selectedWorkflow) {
                    setWorkflow(values.workflow)

                    // HACK: FIXME: it triggers name validation with correct workflow
                    setHideMeta(true)
                    setTimeout(() => {
                      setHideMeta(false)
                    }, 300)
                  }
                }}
              />

              <PD.Container>
                <PD.LeftColumn>
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
                    directory={path}
                    workflow={selectedWorkflow || workflowsConfig}
                    name="name"
                    validate={validators.composeAsync(
                      validators.required,
                      nameValidator.validate,
                    )}
                    validateFields={['name']}
                    errors={{
                      required: 'Enter a package name',
                      invalid: 'Invalid package name',
                      pattern: `Name should match "${selectedWorkflow?.packageNamePattern}" regexp`,
                    }}
                    helperText={nameWarning}
                  />

                  <RF.Field
                    component={PD.CommitMessageInput}
                    name="commitMessage"
                    validate={validators.required as FF.FieldValidator<string>}
                    validateFields={['commitMessage']}
                    errors={{
                      required: 'Enter a commit message',
                    }}
                  />

                  {schemaLoading || hideMeta ? (
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
                </PD.LeftColumn>

                <PD.RightColumn>
                  <RF.Field
                    className={classes.files}
                    // @ts-expect-error
                    component={PD.FilesSelector}
                    name="files"
                    validate={
                      PD.validateNonEmptySelection as FF.FieldValidator<PD.FilesSelectorState>
                    }
                    validateFields={['files']}
                    errors={{
                      [PD.EMPTY_SELECTION]: 'Select something to create a package',
                    }}
                    title="Select files and directories to package"
                    isEqual={R.equals}
                    initialValue={initialFiles}
                    truncated={truncated}
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

interface DialogErrorProps {
  bucket: string
  path: string
  error: $TSFixMe
  onCancel: () => void
}

function DialogError({ bucket, error, path, onCancel }: DialogErrorProps) {
  return (
    <PD.DialogError
      error={error}
      skeletonElement={<PD.FormSkeleton animate={false} />}
      title={<DialogTitle bucket={bucket} path={path} />}
      onCancel={onCancel}
    />
  )
}

interface DialogLoadingProps {
  bucket: string
  path: string
  onCancel: () => void
}

function DialogLoading({ bucket, path, onCancel }: DialogLoadingProps) {
  return (
    <PD.DialogLoading
      skeletonElement={<PD.FormSkeleton />}
      title={<DialogTitle bucket={bucket} path={path} />}
      onCancel={onCancel}
    />
  )
}

interface PackageDirectoryDialogProps {
  bucket: string
  path: string
  truncated?: boolean
  dirs: string[]
  files: { key: string; size: number }[]
  open: boolean
  successor: workflows.Successor | null
  onClose?: () => void
  onExited: (param: { pushed: null | { name: string; hash: string } }) => void
}

export default function PackageDirectoryDialog({
  bucket,
  path,
  truncated,
  dirs,
  files,
  onClose,
  onExited,
  open,
  successor,
}: PackageDirectoryDialogProps) {
  const s3 = AWS.S3.use()

  const [workflow, setWorkflow] = React.useState<workflows.Workflow>()
  const [success, setSuccess] = React.useState<{ name: string; hash: string } | null>(
    null,
  )
  const [submitting, setSubmitting] = React.useState(false)

  const workflowsData = Data.use(
    requests.workflowsConfig,
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

  Intercom.usePauseVisibilityWhen(open)

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
          Err: (e: Error) =>
            successor && (
              <DialogError
                bucket={successor.slug}
                path={path}
                onCancel={handleClose}
                error={e}
              />
            ),
          Ok: (workflowsConfig: workflows.WorkflowsConfig) =>
            successor && (
              <PD.SchemaFetcher workflow={workflow} workflowsConfig={workflowsConfig}>
                {(schemaProps) => (
                  <DialogForm
                    {...schemaProps}
                    {...{
                      bucket,
                      path,
                      truncated,
                      dirs,
                      files,
                      close: handleClose,
                      setSubmitting,
                      setSuccess,
                      setWorkflow,
                      successor,
                      workflowsConfig,
                    }}
                  />
                )}
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
