import * as FF from 'final-form'
import * as FP from 'fp-ts'
import * as R from 'ramda'
import * as React from 'react'
import * as RF from 'react-final-form'
import { Link } from 'react-router-dom'
import * as M from '@material-ui/core'

import * as Intercom from 'components/Intercom'
import AsyncResult from 'utils/AsyncResult'
import * as AWS from 'utils/AWS'
import * as BucketPreferences from 'utils/BucketPreferences'
import * as Data from 'utils/Data'
import * as NamedRoutes from 'utils/NamedRoutes'
import StyledLink from 'utils/StyledLink'
import * as s3paths from 'utils/s3paths'
import * as tagged from 'utils/taggedV2'
import * as validators from 'utils/validators'
import wait from 'utils/wait'
import type * as workflows from 'utils/workflows'

import * as PD from './PackageDialog'
import { isS3File, S3File } from './PackageDialog/S3FilePicker'
import * as requests from './requests'

interface Manifest {
  entries: Record<string, PD.ExistingFile>
  meta: {}
  workflow?: {
    id?: string
  }
}

// TODO: use tree as the main data model / source of truth?

interface LocalEntry {
  path: string
  file: PD.LocalFile
}

interface S3Entry {
  path: string
  file: S3File
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

const EMPTY_MANIFEST_ENTRIES: Record<string, PD.ExistingFile> = {}

interface DialogFormProps {
  bucket: string
  close: () => void
  initial?: {
    manifest?: Manifest
    name?: string
  }
  refresh?: () => void
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

export function DialogForm({
  bucket,
  close,
  initial,
  refresh,
  responseError,
  schema,
  schemaLoading,
  selectedWorkflow,
  setSubmitting,
  setSuccess,
  setWorkflow,
  sourceBuckets,
  validate: validateMetaInput,
  workflowsConfig,
}: DialogFormProps) {
  const nameValidator = PD.useNameValidator()
  const nameExistence = PD.useNameExistence(bucket)
  const [nameWarning, setNameWarning] = React.useState<React.ReactNode>('')
  const [metaHeight, setMetaHeight] = React.useState(0)
  const classes = useStyles()
  const dialogContentClasses = PD.useContentStyles({ metaHeight })
  const validateWorkflow = PD.useWorkflowValidator(workflowsConfig)

  const [selectedBucket, selectBucket] = React.useState(sourceBuckets.getDefault)

  const existingEntries = initial?.manifest?.entries ?? EMPTY_MANIFEST_ENTRIES

  const initialFiles: PD.FilesState = React.useMemo(
    () => ({ existing: existingEntries, added: {}, deleted: {} }),
    [existingEntries],
  )

  const uploads = PD.useUploads()

  const onFilesAction = React.useMemo(
    () =>
      PD.FilesAction.match({
        _: () => {},
        Revert: uploads.remove,
        RevertDir: uploads.removeByPrefix,
        Reset: uploads.reset,
      }),
    [uploads],
  )

  const createPackage = requests.useCreatePackage()

  const onSubmit = async ({
    name,
    msg,
    files,
    meta,
    workflow,
  }: {
    name: string
    msg: string
    files: PD.FilesState
    meta: {}
    workflow: workflows.Workflow
    // eslint-disable-next-line consistent-return
  }) => {
    const addedS3Entries: S3Entry[] = []
    const addedLocalEntries: LocalEntry[] = []
    Object.entries(files.added).forEach(([path, file]) => {
      if (isS3File(file)) {
        addedS3Entries.push({ path, file })
      } else {
        addedLocalEntries.push({ path, file })
      }
    })

    const toUpload = addedLocalEntries.filter(({ path, file }) => {
      const e = files.existing[path]
      return !e || e.hash !== file.hash.value
    })

    let uploadedEntries
    try {
      uploadedEntries = await uploads.upload({
        files: toUpload,
        bucket,
        prefix: name,
        getMeta: (path) => files.existing[path]?.meta,
      })
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Error uploading files:')
      // eslint-disable-next-line no-console
      console.error(e)
      return { [FF.FORM_ERROR]: PD.ERROR_MESSAGES.UPLOAD }
    }

    const s3Entries = FP.function.pipe(
      addedS3Entries,
      R.map(
        ({ path, file }) =>
          [path, { physicalKey: s3paths.handleToS3Url(file) }] as R.KeyValuePair<
            string,
            PD.PartialExistingFile
          >,
      ),
      R.fromPairs,
    )

    const contents = FP.function.pipe(
      files.existing,
      R.omit(Object.keys(files.deleted)),
      R.mergeLeft(uploadedEntries),
      R.mergeLeft(s3Entries),
      R.toPairs,
      R.map(([path, data]: [string, PD.PartialExistingFile]) => ({
        logical_key: path,
        physical_key: data.physicalKey,
        size: data.size,
        hash: data.hash,
        meta: data.meta,
      })),
      R.sortBy(R.prop('logical_key')),
    )

    try {
      const res = await createPackage(
        {
          contents,
          message: msg,
          meta,
          target: {
            name,
            bucket,
          },
          workflow,
        },
        schema,
      )
      if (refresh) {
        // wait for ES index to receive the new package data
        await wait(PD.ES_LAG)
        refresh()
      }
      setSuccess({ name, hash: res.top_hash })
    } catch (e) {
      // eslint-disable-next-line no-console
      console.log('error creating manifest', e)
      // TODO: handle specific cases?
      return { [FF.FORM_ERROR]: e.message || PD.ERROR_MESSAGES.MANIFEST }
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
        const { height } = entries[0]!.contentRect
        setMetaHeight(height)
      }),
    [setMetaHeight],
  )
  const onFormChange = React.useCallback(
    async ({ dirtyFields, values }) => {
      if (dirtyFields?.name) handleNameChange(values.name)
    },
    [handleNameChange],
  )

  React.useEffect(() => {
    if (editorElement) resizeObserver.observe(editorElement)
    return () => {
      if (editorElement) resizeObserver.unobserve(editorElement)
    }
  }, [editorElement, resizeObserver])

  // const username = redux.useSelector(authSelectors.username)
  // const usernamePrefix = React.useMemo(() => PD.getUsernamePrefix(username), [username])

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
      validate={PD.useCryptoApiValidation()}
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
          <M.DialogTitle>Push package revision</M.DialogTitle>
          {/* TODO: make strings customizable or move differeing parts out to seperate components
          <M.DialogTitle>Create package</M.DialogTitle>
          */}
          <M.DialogContent classes={dialogContentClasses}>
            <form className={classes.form} onSubmit={handleSubmit}>
              <RF.FormSpy
                subscription={{ dirtyFields: true, values: true }}
                onChange={onFormChange}
              />

              <RF.FormSpy
                subscription={{ modified: true, values: true }}
                onChange={({ modified, values }) => {
                  if (modified!.workflow) {
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
                    initialValue={initial?.name}
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
                    validating={nameValidator.processing}
                  />

                  <RF.Field
                    component={PD.CommitMessageInput}
                    name="msg"
                    validate={validators.required as FF.FieldValidator<string>}
                    validateFields={['msg']}
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
                      bucket={bucket}
                      schema={schema}
                      schemaError={responseError}
                      validate={validateMetaInput}
                      validateFields={['meta']}
                      isEqual={R.equals}
                      initialValue={initial?.manifest?.meta || PD.EMPTY_META_VALUE}
                      ref={setEditorElement}
                    />
                  )}
                </PD.LeftColumn>

                <PD.RightColumn>
                  <RF.Field
                    // TODO: lazy hashing in package creation mode
                    className={classes.files}
                    // @ts-expect-error
                    component={PD.FilesInput}
                    name="files"
                    validate={
                      validators.composeAsync(
                        validators.nonEmpty,
                        PD.validateHashingComplete,
                      ) as FF.FieldValidator<$TSFixMe>
                    }
                    validateFields={['files']}
                    errors={{
                      nonEmpty: 'Add files to create a package',
                      [PD.HASHING]: 'Please wait while we hash the files',
                      [PD.HASHING_ERROR]:
                        'Error hashing files, probably some of them are too large. Please try again or contact support.',
                    }}
                    totalProgress={uploads.progress}
                    title="Files"
                    onFilesAction={onFilesAction}
                    isEqual={R.equals}
                    initialValue={initialFiles}
                    bucket={selectedBucket}
                    buckets={sourceBuckets.list}
                    selectBucket={selectBucket}
                  />
                </PD.RightColumn>
              </PD.Container>

              <input type="submit" style={{ display: 'none' }} />
            </form>
          </M.DialogContent>
          <M.DialogActions>
            {submitting && (
              <PD.SubmitSpinner value={uploads.progress.percent}>
                {uploads.progress.percent < 100 ? 'Uploading files' : 'Writing manifest'}
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
              {/* TODO: Create */}
            </M.Button>
          </M.DialogActions>
        </>
      )}
    </RF.Form>
  )
}

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

interface DialogWrapperProps {
  exited: boolean
}

function DialogWrapper({
  exited,
  ...props
}: DialogWrapperProps & React.ComponentProps<typeof M.Dialog>) {
  const refProps = { exited, onExited: props.onExited }
  const ref = React.useRef<typeof refProps>()
  ref.current = refProps
  React.useEffect(
    () => () => {
      // call onExited on unmount if it has not been called yet
      if (!ref.current!.exited && ref.current!.onExited)
        (ref.current!.onExited as () => void)()
    },
    [],
  )
  return <M.Dialog {...props} />
}

const DialogState = tagged.create(
  'app/containers/Bucket/PackageUpdateDialog:DialogState' as const,
  {
    Closed: () => {},
    Loading: () => {},
    Error: (e: Error) => e,
    Form: (v: {
      manifest: Manifest
      workflowsConfig: workflows.WorkflowsConfig
      sourceBuckets: BucketPreferences.SourceBuckets
    }) => v,
    Success: (v: { name: string; hash: string }) => v,
  },
)

// eslint-disable-next-line @typescript-eslint/no-redeclare
type DialogState = tagged.InstanceOf<typeof DialogState>

interface UsePackageUpdateDialogProps {
  bucket: string
  name: string
  hash: string
  onExited: (result: { pushed: false | { name: string; hash: string } }) => boolean
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
  const [success, setSuccess] = React.useState<{ name: string; hash: string } | false>(
    false,
  )
  const [submitting, setSubmitting] = React.useState(false)
  const [key, setKey] = React.useState(1)
  const [workflow, setWorkflow] = React.useState<workflows.Workflow>()

  const manifestData = Data.use(
    requests.loadManifest,
    { s3, bucket, name, hash, key },
    { noAutoFetch: !wasOpened },
  )
  const workflowsData = Data.use(requests.workflowsConfig, { s3, bucket })
  // XXX: use AsyncResult
  const preferences = BucketPreferences.use()

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

  const state = React.useMemo<DialogState>(() => {
    if (exited) return DialogState.Closed()
    if (success) return DialogState.Success(success)
    return workflowsData.case({
      Ok: (workflowsConfig: workflows.WorkflowsConfig) =>
        manifestData.case({
          Ok: (manifest: Manifest) =>
            preferences
              ? DialogState.Form({
                  manifest,
                  workflowsConfig,
                  sourceBuckets: preferences.ui.sourceBuckets,
                })
              : DialogState.Loading(),
          Err: DialogState.Error,
          _: DialogState.Loading,
        }),
      Err: DialogState.Error,
      _: DialogState.Loading,
    })
  }, [exited, success, workflowsData, manifestData, preferences])

  const render = React.useCallback(
    () => (
      <DialogWrapper
        exited={exited}
        fullWidth
        maxWidth={success ? 'sm' : 'lg'}
        onClose={close}
        onExited={handleExited}
        open={isOpen}
        scroll="body"
      >
        {DialogState.match(
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
                {AsyncResult.case({
                  Ok: (schemaProps: $TSFixMe) => (
                    <DialogForm
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
                      }}
                    />
                  ),
                  _: R.identity,
                })}
              </PD.SchemaFetcher>
            ),
            Success: (props) => <DialogSuccess {...{ bucket, close, ...props }} />,
          },
          state,
        )}
      </DialogWrapper>
    ),
    [bucket, name, isOpen, exited, close, state, success, handleExited, workflow],
  )

  return React.useMemo(() => ({ open, close, render }), [open, close, render])
}

export const use = usePackageUpdateDialog
