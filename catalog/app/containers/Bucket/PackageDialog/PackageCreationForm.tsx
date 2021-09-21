import * as FF from 'final-form'
import * as FP from 'fp-ts'
import * as R from 'ramda'
import * as React from 'react'
import * as RF from 'react-final-form'
import * as M from '@material-ui/core'

import * as Intercom from 'components/Intercom'
import AsyncResult from 'utils/AsyncResult'
import * as BucketPreferences from 'utils/BucketPreferences'
import * as s3paths from 'utils/s3paths'
import * as tagged from 'utils/taggedV2'
import * as validators from 'utils/validators'
import type * as workflows from 'utils/workflows'

import DialogError from './DialogError'
import DialogLoading from './DialogLoading'
import DialogSuccess, { DialogSuccessRenderMessageProps } from './DialogSuccess'
import * as FI from './FilesInput'
import * as Layout from './Layout'
import * as PD from './PackageDialog'
import { isS3File, S3File } from './S3FilePicker'
import { FormSkeleton, MetaInputSkeleton } from './Skeleton'
import SubmitSpinner from './SubmitSpinner'
import { useUploads } from './Uploads'
import * as requests from '../requests'

const EMPTY_MANIFEST_ENTRIES: Record<string, FI.ExistingFile> = {}

export interface Manifest {
  entries: Record<string, FI.ExistingFile>
  meta: {}
  workflow?: {
    id?: string
  }
}

// TODO: use tree as the main data model / source of truth?

export interface LocalEntry {
  path: string
  file: FI.LocalFile
}

export interface S3Entry {
  path: string
  file: S3File
}

export interface PackageCreationSuccess {
  name: string
  hash: string
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

interface PackageCreationFormProps {
  bucket: string
  close: () => void
  initial?: {
    manifest?: Manifest
    name?: string
  }
  setSubmitting: (submitting: boolean) => void
  setSuccess: (success: PackageCreationSuccess) => void
  setWorkflow: (workflow: workflows.Workflow) => void
  sourceBuckets: BucketPreferences.SourceBuckets
  workflowsConfig: workflows.WorkflowsConfig
  delayHashing: boolean
  disableStateDisplay: boolean
  ui?: {
    title?: React.ReactNode
    submit?: React.ReactNode
    resetFiles?: React.ReactNode
  }
}

export function PackageCreationForm({
  bucket,
  close,
  initial,
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
  delayHashing,
  disableStateDisplay,
  ui = {},
}: PackageCreationFormProps & PD.SchemaFetcherRenderProps) {
  const nameValidator = PD.useNameValidator()
  const nameExistence = PD.useNameExistence(bucket)
  const [nameWarning, setNameWarning] = React.useState<React.ReactNode>('')
  const [metaHeight, setMetaHeight] = React.useState(0)
  const classes = useStyles()
  const dialogContentClasses = PD.useContentStyles({ metaHeight })
  const validateWorkflow = PD.useWorkflowValidator(workflowsConfig)

  const [selectedBucket, selectBucket] = React.useState(sourceBuckets.getDefault)

  const existingEntries = initial?.manifest?.entries ?? EMPTY_MANIFEST_ENTRIES

  const initialFiles: FI.FilesState = React.useMemo(
    () => ({ existing: existingEntries, added: {}, deleted: {} }),
    [existingEntries],
  )

  const uploads = useUploads()

  const onFilesAction = React.useMemo(
    () =>
      FI.FilesAction.match({
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
    files: FI.FilesState
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
            FI.PartialExistingFile
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
      R.map(([path, data]: [string, FI.PartialExistingFile]) => ({
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
      const errorMessage = e instanceof Error ? e.message : null
      return { [FF.FORM_ERROR]: errorMessage || PD.ERROR_MESSAGES.MANIFEST }
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

  const nonEmpty = (value: FI.FilesState) => {
    const filesToAdd = Object.assign({}, value.existing, value.added)
    return (
      validators.nonEmpty(filesToAdd) ||
      validators.nonEmpty(R.omit(Object.keys(value.deleted), filesToAdd))
    )
  }

  const validateFiles = React.useMemo(
    () =>
      delayHashing
        ? nonEmpty
        : validators.composeAsync(nonEmpty, FI.validateHashingComplete),
    [delayHashing],
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
        error,
        hasValidationErrors,
        submitError,
        submitFailed,
        submitting,
        handleSubmit,
      }) => (
        <>
          <M.DialogTitle>{ui.title || 'Create package'}</M.DialogTitle>
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

              <Layout.Container>
                <Layout.LeftColumn>
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
                    <MetaInputSkeleton className={classes.meta} ref={setEditorElement} />
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
                </Layout.LeftColumn>

                <Layout.RightColumn>
                  <RF.Field
                    className={classes.files}
                    // @ts-expect-error
                    component={FI.FilesInput}
                    name="files"
                    validate={validateFiles as FF.FieldValidator<$TSFixMe>}
                    validateFields={['files']}
                    errors={{
                      nonEmpty: 'Add files to create a package',
                      [FI.HASHING]: 'Please wait while we hash the files',
                      [FI.HASHING_ERROR]:
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
                    delayHashing={delayHashing}
                    disableStateDisplay={disableStateDisplay}
                    ui={{ reset: ui.resetFiles }}
                  />
                </Layout.RightColumn>
              </Layout.Container>

              <input type="submit" style={{ display: 'none' }} />
            </form>
          </M.DialogContent>
          <M.DialogActions>
            {submitting && (
              <SubmitSpinner value={uploads.progress.percent}>
                {uploads.progress.percent < 100 ? 'Uploading files' : 'Writing manifest'}
              </SubmitSpinner>
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
              {ui.submit || 'Create'}
            </M.Button>
          </M.DialogActions>
        </>
      )}
    </RF.Form>
  )
}

export const PackageCreationDialogState = tagged.create(
  'app/containers/Bucket/PackageDialog/PackageCreationForm:DialogState' as const,
  {
    Closed: () => {},
    Loading: () => {},
    Error: (e: Error) => e,
    Form: (v: {
      manifest?: Manifest
      workflowsConfig: workflows.WorkflowsConfig
      sourceBuckets: BucketPreferences.SourceBuckets
    }) => v,
    Success: (v: PackageCreationSuccess) => v,
  },
)

// eslint-disable-next-line @typescript-eslint/no-redeclare
export type PackageCreationDialogState = tagged.InstanceOf<
  typeof PackageCreationDialogState
>

interface UsePackageCreationDialogProps {
  bucket: string
  data?: $TSFixMe // AsyncResult<{ manifest, workflowsConfig, sourceBuckets }>
  delayHashing?: boolean
  disableStateDisplay?: boolean
  fetch?: () => void
  name?: string
  onExited: (result: {
    pushed: PackageCreationSuccess | false
  }) => boolean | undefined | void
  refresh?: () => void
  ui?: {
    resetFiles?: React.ReactNode
    submit?: React.ReactNode
    successBrowse?: React.ReactNode
    successRenderMessage?: (props: DialogSuccessRenderMessageProps) => React.ReactNode
    successTitle?: React.ReactNode
    title?: React.ReactNode
  }
}

export function usePackageCreationDialog({
  bucket,
  data,
  delayHashing = false,
  disableStateDisplay = false,
  fetch,
  name,
  onExited,
  refresh,
  ui = {},
}: UsePackageCreationDialogProps) {
  const [isOpen, setOpen] = React.useState(false)
  const [exited, setExited] = React.useState(!isOpen)
  const [success, setSuccess] = React.useState<PackageCreationSuccess | false>(false)
  const [submitting, setSubmitting] = React.useState(false)
  const [workflow, setWorkflow] = React.useState<workflows.Workflow>()

  const open = React.useCallback(() => {
    setOpen(true)
    fetch?.()
    setExited(false)
  }, [setOpen, fetch, setExited])

  const close = React.useCallback(() => {
    if (submitting) return
    setOpen(false)
    setWorkflow(undefined) // TODO: is this necessary?
  }, [submitting, setOpen])

  const handleExited = React.useCallback(() => {
    setExited(true)
    setSuccess(false)
    if (onExited) {
      const shouldRefresh = onExited({ pushed: success })
      if (shouldRefresh) refresh?.()
    }
  }, [setExited, setSuccess, success, onExited, refresh])

  Intercom.usePauseVisibilityWhen(isOpen)

  const state = React.useMemo<PackageCreationDialogState>(() => {
    if (exited) return PackageCreationDialogState.Closed()
    if (success) return PackageCreationDialogState.Success(success)
    return AsyncResult.case(
      {
        Ok: PackageCreationDialogState.Form,
        Err: PackageCreationDialogState.Error,
        _: PackageCreationDialogState.Loading,
      },
      data,
    )
  }, [exited, success, data])

  const element = (
    <PD.DialogWrapper
      exited={exited}
      fullWidth
      maxWidth={success ? 'sm' : 'lg'}
      onClose={close}
      onExited={handleExited}
      open={isOpen}
      scroll="body"
    >
      {PackageCreationDialogState.match(
        {
          Closed: () => null,
          Loading: () => (
            <DialogLoading
              skeletonElement={<FormSkeleton />}
              title="Fetching package manifest. One moment…"
              submitText={ui.submit}
              onCancel={close}
            />
          ),
          Error: (e) => (
            <DialogError
              error={e}
              skeletonElement={<FormSkeleton animate={false} />}
              title={ui.title || 'Create package'}
              submitText={ui.submit}
              onCancel={close}
            />
          ),
          Form: ({ manifest, workflowsConfig, sourceBuckets }) => (
            <PD.SchemaFetcher
              manifest={manifest}
              workflowsConfig={workflowsConfig}
              workflow={workflow}
            >
              {(schemaProps) => (
                <PackageCreationForm
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
                    delayHashing,
                    disableStateDisplay,
                    ui: {
                      title: ui.title,
                      submit: ui.submit,
                      resetFiles: ui.resetFiles,
                    },
                  }}
                />
              )}
            </PD.SchemaFetcher>
          ),
          Success: (props) => (
            <DialogSuccess
              {...props}
              bucket={bucket}
              onClose={close}
              browseText={ui.successBrowse}
              title={ui.successTitle}
              renderMessage={ui.successRenderMessage}
            />
          ),
        },
        state,
      )}
    </PD.DialogWrapper>
  )

  return { open, close, element }
}
