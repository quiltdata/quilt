import type { S3 } from 'aws-sdk'
import * as FF from 'final-form'
import invariant from 'invariant'
import pLimit from 'p-limit'
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
import pipeThru from 'utils/pipeThru'
import * as s3paths from 'utils/s3paths'
import * as tagged from 'utils/taggedV2'
import * as validators from 'utils/validators'
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

interface UploadResult extends S3.ManagedUpload.SendData {
  VersionId: string
}

const dissocBy = (fn: (key: string) => boolean) =>
  R.pipe(
    // @ts-expect-error
    R.toPairs,
    R.filter(([k]) => !fn(k)),
    R.fromPairs,
  ) as { <T>(obj: Record<string, T>): Record<string, T> }

// TODO: use tree as the main data model / source of truth?

interface TotalProgress {
  total: number
  loaded: number
  percent: number
}

interface Uploads {
  [path: string]: {
    file: File
    upload: S3.ManagedUpload
    promise: Promise<UploadResult>
    progress?: { total: number; loaded: number }
  }
}

interface LocalEntry {
  path: string
  file: PD.LocalFile
}

interface S3Entry {
  path: string
  file: S3File
}

const getTotalProgress = R.pipe(
  R.values,
  R.reduce(
    (acc, { progress: p }: Uploads[string]) => ({
      total: acc.total + ((p && p.total) || 0),
      loaded: acc.loaded + ((p && p.loaded) || 0),
    }),
    { total: 0, loaded: 0 },
  ),
  (p) => ({
    ...p,
    percent: p.total ? Math.floor((p.loaded / p.total) * 100) : 100,
  }),
) as (uploads: Uploads) => TotalProgress

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

interface DialogFormProps {
  bucket: string
  close: () => void
  manifest: Manifest
  name: string
  responseError: Error
  schema: $TSFixMe
  schemaLoading: boolean
  selectedWorkflow: workflows.Workflow
  setSubmitting: (submitting: boolean) => void
  setSuccess: (success: { name: string; hash: string }) => void
  setWorkflow: (workflow: workflows.Workflow) => void
  validate: FF.FieldValidator<any>
  workflowsConfig: workflows.WorkflowsConfig
  sourceBuckets: BucketPreferences.SourceBuckets
}

function DialogForm({
  bucket,
  close,
  manifest,
  name: initialName,
  responseError,
  schema,
  schemaLoading,
  selectedWorkflow,
  setSubmitting,
  setSuccess,
  setWorkflow,
  validate: validateMetaInput,
  workflowsConfig,
  sourceBuckets,
}: DialogFormProps) {
  const s3 = AWS.S3.use()
  const [uploads, setUploads] = React.useState<Uploads>({})
  const nameValidator = PD.useNameValidator()
  const nameExistence = PD.useNameExistence(bucket)
  const [nameWarning, setNameWarning] = React.useState<React.ReactNode>('')
  const [metaHeight, setMetaHeight] = React.useState(0)
  const classes = useStyles()
  const dialogContentClasses = PD.useContentStyles({ metaHeight })
  const validateWorkflow = PD.useWorkflowValidator(workflowsConfig)

  const [selectedBucket, selectBucket] = React.useState(sourceBuckets.getDefault)

  const initialFiles: PD.FilesState = React.useMemo(
    () => ({ existing: manifest.entries, added: {}, deleted: {} }),
    [manifest.entries],
  )

  const totalProgress = React.useMemo(() => getTotalProgress(uploads), [uploads])

  const onFilesAction = React.useMemo(
    () =>
      PD.FilesAction.match({
        _: () => {},
        Revert: (path) => setUploads(R.dissoc(path)),
        RevertDir: (prefix) => setUploads(dissocBy(R.startsWith(prefix))),
        Reset: () => setUploads({}),
      }),
    [setUploads],
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
    const addedS3Entries = [] as S3Entry[]
    const addedLocalEntries = [] as LocalEntry[]
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

    const limit = pLimit(2)
    let rejected = false
    const uploadStates = toUpload.map(({ path, file }) => {
      // reuse state if file hasnt changed
      const entry = uploads[path]
      if (entry && entry.file === file) return { ...entry, path }

      const upload: S3.ManagedUpload = s3.upload(
        {
          Bucket: bucket,
          Key: `${name}/${path}`,
          Body: file,
        },
        {
          queueSize: 2,
        },
      )
      upload.on('httpUploadProgress', ({ loaded }) => {
        if (rejected) return
        setUploads(R.assocPath([path, 'progress', 'loaded'], loaded))
      })
      const promise = limit(async () => {
        if (rejected) {
          setUploads(R.dissoc(path))
          return
        }
        try {
          // eslint-disable-next-line consistent-return
          return await upload.promise()
        } catch (e) {
          rejected = true
          setUploads(R.dissoc(path))
          throw e
        }
      })
      return { path, file, upload, promise, progress: { total: file.size, loaded: 0 } }
    })

    pipeThru(uploadStates)(
      R.map(({ path, ...rest }) => ({ [path]: rest })),
      R.mergeAll,
      setUploads,
    )

    let uploaded
    try {
      uploaded = await Promise.all(uploadStates.map((x) => x.promise))
    } catch (e) {
      return { [FF.FORM_ERROR]: PD.ERROR_MESSAGES.UPLOAD }
    }

    type Zipped = [
      string,
      { physicalKey: string; size: number; hash: string; meta: unknown },
    ]

    const uploadedEntries = pipeThru(toUpload, uploaded)(
      R.zipWith<LocalEntry, UploadResult, Zipped>((f, r) => {
        invariant(f.file.hash.value, 'File must have a hash')
        return [
          f.path,
          {
            physicalKey: s3paths.handleToS3Url({
              bucket,
              key: r.Key,
              version: r.VersionId,
            }),
            size: f.file.size,
            hash: f.file.hash.value,
            meta: R.prop('meta', files.existing[f.path]),
          },
        ]
      }),
      R.fromPairs,
    ) as Record<
      string,
      { physicalKey: string; size: number; hash: string; meta: unknown }
    >

    const s3Entries = pipeThru(addedS3Entries)(
      R.map(({ path, file }: S3Entry) => [
        path,
        { physicalKey: s3paths.handleToS3Url(file) },
      ]),
      R.fromPairs,
    ) as Record<string, { physicalKey: string }>

    const contents = pipeThru(files.existing)(
      R.omit(Object.keys(files.deleted)),
      R.mergeLeft(uploadedEntries),
      R.mergeLeft(s3Entries),
      R.toPairs,
      R.map(([path, data]) => ({
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

  const onFormChange = React.useCallback(
    async ({ values }) => {
      if (editorElement && document.body.contains(editorElement)) {
        setMetaHeight(editorElement.clientHeight)
      }

      handleNameChange(values.name)
    },
    [editorElement, handleNameChange, setMetaHeight],
  )

  React.useEffect(() => {
    if (editorElement && document.body.contains(editorElement)) {
      setMetaHeight(editorElement.clientHeight)
    }
  }, [editorElement, setMetaHeight])

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
        handleSubmit,
        submitting,
        submitFailed,
        error,
        submitError,
        hasValidationErrors,
      }) => (
        <>
          <M.DialogTitle>Push package revision</M.DialogTitle>
          <M.DialogContent classes={dialogContentClasses}>
            <form className={classes.form} onSubmit={handleSubmit}>
              <RF.FormSpy
                subscription={{ modified: true, values: true }}
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
                      initialValue={manifest.meta || PD.EMPTY_META_VALUE}
                      ref={setEditorElement}
                    />
                  )}
                </PD.LeftColumn>

                <PD.RightColumn>
                  <RF.Field
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
                    totalProgress={totalProgress}
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
              <PD.SubmitSpinner value={totalProgress.percent}>
                {totalProgress.percent < 100 ? 'Uploading files' : 'Writing manifest'}
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
  name: string
  hash: string
  close: () => void
}

function DialogSuccess({ bucket, name, hash, close }: DialogSuccessProps) {
  const classes = useDialogStyles()
  const { urls } = NamedRoutes.use()
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
                        manifest,
                        name,
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
