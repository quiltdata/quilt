import * as FF from 'final-form'
import * as R from 'ramda'
import * as React from 'react'
import * as RF from 'react-final-form'
import * as urql from 'urql'
import * as M from '@material-ui/core'

import * as Intercom from 'components/Intercom'
import * as AWS from 'utils/AWS'
import * as Data from 'utils/Data'
import * as NamedRoutes from 'utils/NamedRoutes'
import StyledLink from 'utils/StyledLink'
import assertNever from 'utils/assertNever'
import { mkFormError, mapInputErrors } from 'utils/formTools'
import * as tagged from 'utils/taggedV2'
import * as Types from 'utils/types'
import * as validators from 'utils/validators'
import * as workflows from 'utils/workflows'

import * as PD from './PackageDialog'
import PACKAGE_PROMOTE from './PackageDialog/gql/PackagePromote.generated'
import * as requests from './requests'

const useFormSkeletonStyles = M.makeStyles((t) => ({
  meta: {
    marginTop: t.spacing(3),
  },
}))

interface FormSkeletonProps {
  animate?: boolean
}

function FormSkeleton({ animate }: FormSkeletonProps) {
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

interface DialogTitleProps {
  bucket: string
}

function DialogTitle({ bucket }: DialogTitleProps) {
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

interface DialogFormProps {
  bucket: string
  close: () => void
  hash: string
  initialMeta: PD.Manifest['meta']
  name: string
  setSubmitting: (submitting: boolean) => void
  setSuccess: (success: PackageCreationSuccess) => void
  setWorkflow: (workflow: workflows.Workflow) => void
  successor: workflows.Successor
  workflowsConfig: workflows.WorkflowsConfig
}

function DialogForm({
  bucket,
  close,
  hash,
  initialMeta,
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
}: DialogFormProps & PD.SchemaFetcherRenderProps) {
  const nameValidator = PD.useNameValidator(selectedWorkflow)
  const nameExistence = PD.useNameExistence(successor.slug)
  const [nameWarning, setNameWarning] = React.useState<React.ReactNode>('')
  const [metaHeight, setMetaHeight] = React.useState(0)
  const classes = useStyles()
  const validateWorkflow = PD.useWorkflowValidator(workflowsConfig)

  const [, copyPackage] = urql.useMutation(PACKAGE_PROMOTE)

  interface FormData {
    commitMessage: string
    name: string
    meta: Types.JsonRecord | undefined
    workflow: workflows.Workflow
  }

  // eslint-disable-next-line consistent-return
  const onSubmit = async ({ commitMessage, name, meta, workflow }: FormData) => {
    try {
      const res = await copyPackage({
        params: {
          bucket: successor.slug,
          name,
          message: commitMessage,
          userMeta: requests.getMetaValue(meta, schema) ?? null,
          workflow:
            // eslint-disable-next-line no-nested-ternary
            workflow.slug === workflows.notAvailable
              ? null
              : workflow.slug === workflows.notSelected
              ? ''
              : workflow.slug,
        },
        src: {
          bucket,
          name: initialName,
          hash,
        },
      })
      if (res.error) throw res.error
      if (!res.data) throw new Error('No data returned by the API')
      const r = res.data.packagePromote
      switch (r.__typename) {
        case 'PackagePushSuccess':
          setSuccess({ name, hash: r.revision.hash, bucket: successor.slug })
          return
        case 'OperationError':
          return mkFormError(r.message)
        case 'InvalidInput':
          return mapInputErrors(r.errors)
        default:
          assertNever(r)
      }
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error('Error creating manifest:')
      // eslint-disable-next-line no-console
      console.error(e)
      return mkFormError(
        e.message ? `Unexpected error: ${e.message}` : PD.ERROR_MESSAGES.MANIFEST,
      )
    }
  }

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

  const [editorElement, setEditorElement] = React.useState<HTMLDivElement | null>(null)
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
                  if (modified?.workflow) {
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
                validate={validators.required as FF.FieldValidator<any>}
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
                  initialValue={initialMeta}
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

interface DialogErrorProps {
  bucket: string
  error: Error
  onCancel: () => void
}

function DialogError({ bucket, error, onCancel }: DialogErrorProps) {
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

interface DialogLoadingProps {
  bucket: string
  onCancel: () => void
}

function DialogLoading({ bucket, onCancel }: DialogLoadingProps) {
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

interface PackageCreationSuccess {
  bucket: string
  name: string
  hash: string
}

const DialogState = tagged.create(
  'app/containers/Bucket/PackageCopyDialog:DialogState' as const,
  {
    Loading: () => {},
    Error: (e: Error) => e,
    Form: (v: { manifest: PD.Manifest; workflowsConfig: workflows.WorkflowsConfig }) => v,
    Success: (v: PackageCreationSuccess) => v,
  },
)

interface PackageCopyDialogProps {
  open: boolean
  bucket: string
  successor: workflows.Successor | null
  name: string
  hash: string
  onExited: (props: { pushed: PackageCreationSuccess | null }) => void
}

export default function PackageCopyDialog({
  open,
  bucket,
  successor,
  name,
  hash,
  onExited,
}: PackageCopyDialogProps) {
  const s3 = AWS.S3.use()

  const [success, setSuccess] = React.useState<PackageCreationSuccess | null>(null)
  const [submitting, setSubmitting] = React.useState(false)

  const [workflow, setWorkflow] = React.useState<workflows.Workflow>()

  const manifestData = PD.useManifest({
    bucket,
    name,
    hash,
    skipEntries: true,
    pause: !successor || !open,
  })

  const workflowsData = Data.use(
    requests.workflowsConfig,
    { s3, bucket: successor ? successor.slug : '' },
    { noAutoFetch: !successor || !open },
  )

  const state = React.useMemo(() => {
    if (success) return DialogState.Success(success)
    return workflowsData.case({
      Ok: (workflowsConfig: workflows.WorkflowsConfig) =>
        manifestData.case({
          Ok: (manifest: PD.Manifest) => DialogState.Form({ manifest, workflowsConfig }),
          Err: DialogState.Error,
          _: DialogState.Loading,
        }),
      Err: DialogState.Error,
      _: DialogState.Loading,
    })
  }, [success, workflowsData, manifestData])

  const handleExited = React.useCallback(() => {
    if (submitting) return

    onExited({
      pushed: success,
    })
    setSuccess(null)
  }, [submitting, success, setSuccess, onExited])

  const close = React.useCallback(() => {
    if (submitting) return

    onExited({
      pushed: success,
    })
    setSuccess(null)
  }, [submitting, success, setSuccess, onExited])

  Intercom.usePauseVisibilityWhen(open)

  return (
    <M.Dialog fullWidth onClose={close} onExited={handleExited} open={open} scroll="body">
      {DialogState.match({
        Error: (e) =>
          successor && <DialogError bucket={successor.slug} onCancel={close} error={e} />,
        Loading: () =>
          successor && <DialogLoading bucket={successor.slug} onCancel={close} />,
        Form: ({ manifest, workflowsConfig }) =>
          successor && (
            <PD.SchemaFetcher
              initialWorkflowId={manifest.workflowId}
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
                    initialMeta: manifest.meta,
                    hash,
                    name,
                    successor,
                  }}
                />
              )}
            </PD.SchemaFetcher>
          ),
        Success: (props) => successor && <PD.DialogSuccess {...props} onClose={close} />,
      })(state)}
    </M.Dialog>
  )
}
