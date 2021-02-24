import type { S3 } from 'aws-sdk'
import * as FF from 'final-form'
import pLimit from 'p-limit'
import * as R from 'ramda'
import * as React from 'react'
import * as RF from 'react-final-form'
import { Link } from 'react-router-dom'
import * as M from '@material-ui/core'

import Code from 'components/Code'
import * as APIConnector from 'utils/APIConnector'
import AsyncResult from 'utils/AsyncResult'
import * as AWS from 'utils/AWS'
import * as Data from 'utils/Data'
import * as NamedRoutes from 'utils/NamedRoutes'
import StyledLink from 'utils/StyledLink'
import pipeThru from 'utils/pipeThru'
import * as s3paths from 'utils/s3paths'
import * as tagged from 'utils/taggedV2'
import * as validators from 'utils/validators'

import * as PD from './PackageDialog'
import * as requests from './requests'

type WorkflowsConfig = $TSFixMe

interface Manifest {
  entries: Record<string, PD.ExistingFile>
  meta: $TSFixMe
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
    promise: Promise<{ result: UploadResult; hash: string } | undefined>
    progress?: { total: number; loaded: number }
  }
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
  meta: {
    marginTop: t.spacing(3),
  },
}))

interface DialogFormProps {
  bucket: string
  close: () => void
  manifest: Manifest
  name: string
  responseError: $TSFixMe
  schema: $TSFixMe
  schemaLoading: boolean
  selectedWorkflow: $TSFixMe
  setSubmitting: (submitting: boolean) => void
  setSuccess: (success: $TSFixMe) => void
  setWorkflow: (workflow: $TSFixMe) => void
  validate: FF.FieldValidator<any>
  workflowsConfig: WorkflowsConfig
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
}: DialogFormProps) {
  const s3 = AWS.S3.use()
  const req = APIConnector.use()
  const [uploads, setUploads] = React.useState<Uploads>({})
  const nameValidator = PD.useNameValidator()
  const nameExistence = PD.useNameExistence(bucket)
  const [nameWarning, setNameWarning] = React.useState<React.ReactNode>('')
  const classes = useStyles()

  const initialFiles: PD.FilesState = React.useMemo(
    () => ({ existing: manifest.entries, added: {}, deleted: {} }),
    [manifest.entries],
  )

  const totalProgress = React.useMemo(() => getTotalProgress(uploads), [uploads])

  const onFilesAction = React.useMemo(
    () =>
      PD.FilesAction.case({
        _: () => {},
        Revert: (path) => setUploads(R.dissoc(path)),
        RevertDir: (prefix) => setUploads(dissocBy(R.startsWith(prefix))),
        Reset: () => setUploads({}),
      }),
    [setUploads],
  )

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
    workflow: $TSFixMe
    // eslint-disable-next-line consistent-return
  }) => {
    const toUpload = Object.entries(files.added).map(([path, file]) => ({ path, file }))

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
        const resultP = upload.promise()
        const hashP = PD.hashFile(file)
        try {
          // eslint-disable-next-line consistent-return
          return { result: await resultP, hash: await hashP }
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

    const newEntries = pipeThru(toUpload, uploaded)(
      /// XXX: u may be undefined?
      R.zipWith(
        (f: { path: string; file: File }, u: { result: UploadResult; hash: string }) => [
          f.path,
          {
            physicalKey: s3paths.handleToS3Url({
              bucket,
              key: u.result.Key,
              version: u.result.VersionId,
            }),
            size: f.file.size,
            hash: u.hash,
            meta: R.prop('meta', files.existing[f.path]),
          },
        ],
      ),
      R.fromPairs,
    )

    const contents = pipeThru(files.existing)(
      R.omit(Object.keys(files.deleted)),
      R.mergeLeft(newEntries),
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
      const res = await req({
        endpoint: '/packages',
        method: 'POST',
        body: {
          name,
          registry: `s3://${bucket}`,
          message: msg,
          contents,
          meta: PD.getMetaValue(meta, schema),
          // FIXME: this obvsly shouldnt be cast to never
          workflow: PD.getWorkflowApiParam(workflow.slug as never),
        },
      })
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

  const onFormChange = React.useCallback(
    async ({ modified, values }) => {
      if (!modified.name) return

      const { name } = values

      let warning: React.ReactNode = ''

      if (name !== initialName) {
        const nameExists = await nameExistence.validate(name)
        if (nameExists) {
          warning = (
            <>
              <Code>{name}</Code> already exists. Click Push to create a new revision.
            </>
          )
        } else {
          warning = (
            <>
              <Code>{name}</Code> is a new package
            </>
          )
        }
      }

      if (warning !== nameWarning) {
        setNameWarning(warning)
      }
    },
    [nameWarning, initialName, nameExistence],
  )

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
          <M.DialogContent style={{ paddingTop: 0 }}>
            <form onSubmit={handleSubmit}>
              <RF.FormSpy
                subscription={{ modified: true, values: true }}
                onChange={onFormChange}
              />
              <PD.Container>
                <PD.LeftColumn>
                  <M.Typography color={submitting ? 'textSecondary' : undefined}>
                    Main
                  </M.Typography>

                  <RF.FormSpy
                    subscription={{ modified: true, values: true }}
                    onChange={({ modified, values }) => {
                      if (modified!.workflow) {
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
                    name="msg"
                    validate={validators.required as FF.FieldValidator<string>}
                    validateFields={['msg']}
                    errors={{
                      required: 'Enter a commit message',
                    }}
                  />

                  {schemaLoading ? (
                    <PD.MetaInputSkeleton className={classes.meta} />
                  ) : (
                    <RF.Field
                      className={classes.meta}
                      // @ts-expect-error
                      component={PD.MetaInput}
                      name="meta"
                      bucket={bucket}
                      schema={schema}
                      schemaError={responseError}
                      validate={validateMetaInput}
                      validateFields={['meta']}
                      isEqual={R.equals}
                      initialValue={manifest.meta}
                    />
                  )}

                  <RF.Field
                    component={PD.WorkflowInput}
                    name="workflow"
                    workflowsConfig={workflowsConfig}
                    initialValue={selectedWorkflow}
                    validate={validators.required as FF.FieldValidator<any>}
                    validateFields={['meta', 'workflow']}
                    errors={{
                      required: 'Workflow is required for this bucket.',
                    }}
                  />
                </PD.LeftColumn>

                <PD.RightColumn>
                  <RF.Field
                    className={classes.files}
                    // @ts-expect-error
                    component={PD.FilesInput}
                    name="files"
                    validate={validators.nonEmpty as FF.FieldValidator<$TSFixMe>}
                    validateFields={['files']}
                    errors={{
                      nonEmpty: 'Add files to create a package',
                    }}
                    totalProgress={totalProgress}
                    title="Files"
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

interface DialogPlaceholderProps {
  close?: () => void
}

function DialogPlaceholder({ close }: DialogPlaceholderProps) {
  return (
    <>
      <M.DialogTitle>Push package revision</M.DialogTitle>
      <M.DialogContent style={{ paddingTop: 0 }}>
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
  const { urls } = NamedRoutes.use()
  return (
    <>
      <M.DialogTitle>Push complete</M.DialogTitle>
      <M.DialogContent style={{ paddingTop: 0 }}>
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
    Form: (v: { manifest: Manifest; workflowsConfig: WorkflowsConfig }) => v,
    Success: (v: { name: string; hash: string }) => v,
  },
)

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
  const [workflow, setWorkflow] = React.useState(null)

  const manifestData = Data.use(
    requests.loadManifest,
    { s3, bucket, name, hash, key },
    { noAutoFetch: !wasOpened },
  )
  const workflowsData = Data.use(requests.workflowsList, { s3, bucket })

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

  const state = React.useMemo(() => {
    if (exited) return DialogState.Closed()
    if (success) return DialogState.Success(success)
    return workflowsData.case({
      Ok: (workflowsConfig: WorkflowsConfig) =>
        manifestData.case({
          Ok: (manifest: Manifest) => DialogState.Form({ manifest, workflowsConfig }),
          Err: DialogState.Error,
          _: DialogState.Loading,
        }),
      Err: DialogState.Error,
      _: DialogState.Loading,
    })
  }, [exited, success, workflowsData, manifestData])

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
            Form: ({ manifest, workflowsConfig }) => (
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
