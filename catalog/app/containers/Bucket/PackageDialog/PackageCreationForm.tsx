import type { ErrorObject } from 'ajv'
import cx from 'classnames'
import * as FF from 'final-form'
import * as FP from 'fp-ts'
import * as R from 'ramda'
import * as React from 'react'
import * as RF from 'react-final-form'
import * as urql from 'urql'
import * as M from '@material-ui/core'

import * as Intercom from 'components/Intercom'
import JsonValidationErrors from 'components/JsonValidationErrors'
import * as Model from 'model'
import * as AWS from 'utils/AWS'
import AsyncResult from 'utils/AsyncResult'
import * as BucketPreferences from 'utils/BucketPreferences'
import * as Config from 'utils/Config'
import * as Data from 'utils/Data'
import assertNever from 'utils/assertNever'
import * as s3paths from 'utils/s3paths'
import * as tagged from 'utils/taggedV2'
import * as Types from 'utils/types'
import * as validators from 'utils/validators'
import * as workflows from 'utils/workflows'

import * as Download from '../Download'
import * as Upload from '../Upload'
import * as requests from '../requests'

import DialogError from './DialogError'
import DialogLoading from './DialogLoading'
import DialogSuccess, { DialogSuccessRenderMessageProps } from './DialogSuccess'
import * as FI from './FilesInput'
import * as Layout from './Layout'
import * as MI from './MetaInput'
import * as PD from './PackageDialog'
import { isS3File, S3File } from './S3FilePicker'
import { FormSkeleton, MetaInputSkeleton } from './Skeleton'
import SubmitSpinner from './SubmitSpinner'
import { useUploads } from './Uploads'
import PACKAGE_CONSTRUCT from './gql/PackageConstruct.generated'
import { Manifest, EMPTY_MANIFEST_ENTRIES, useManifest } from './Manifest'

type PartialPackageEntry = Types.AtLeast<Model.PackageEntry, 'physicalKey'>

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
  hash?: string
}

const useStyles = M.makeStyles((t) => ({
  files: {
    height: '100%',
  },
  filesWithError: {
    height: `calc(90% - ${t.spacing()}px)`,
  },
  filesError: {
    marginTop: t.spacing(),
    maxHeight: t.spacing(9),
    overflowY: 'auto',
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

interface PackageCreationFormProps {
  bucket: string
  close: () => void
  initial?: {
    name?: string
    meta?: Types.JsonRecord
    workflowId?: string
    entries?: Model.PackageContentsFlatMap
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

function PackageCreationForm({
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
  const nameValidator = PD.useNameValidator(selectedWorkflow)
  const nameExistence = PD.useNameExistence(bucket)
  const [nameWarning, setNameWarning] = React.useState<React.ReactNode>('')
  const [metaHeight, setMetaHeight] = React.useState(0)
  const { desktop }: { desktop: boolean } = Config.use()
  const classes = useStyles()
  const dialogContentClasses = PD.useContentStyles({ metaHeight })
  const validateWorkflow = PD.useWorkflowValidator(workflowsConfig)

  const [entriesError, setEntriesError] = React.useState<(Error | ErrorObject)[] | null>(
    null,
  )

  const [selectedBucket, selectBucket] = React.useState(sourceBuckets.getDefault)

  const existingEntries = initial?.entries ?? EMPTY_MANIFEST_ENTRIES

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

  const [, constructPackage] = urql.useMutation(PACKAGE_CONSTRUCT)
  const validateEntries = PD.useEntriesValidator(selectedWorkflow)

  const uploadPackage = Upload.useUploadPackage()

  interface SubmitArgs {
    name: string
    msg: string
    meta: {}
    localFolder?: string
    workflow: workflows.Workflow
  }
  interface SubmitWebArgs extends SubmitArgs {
    files: FI.FilesState
  }
  interface SubmitElectronArgs extends SubmitArgs {
    localFolder: string
  }

  const onSubmitElectron = React.useCallback(
    async ({ name, msg, localFolder, meta, workflow }: SubmitElectronArgs) => {
      const payload = {
        entry: localFolder || '',
        message: msg,
        meta,
        workflow,
      }
      const uploadResult = await uploadPackage(payload, { name, bucket }, schema)
      setSuccess({ name, hash: uploadResult?.hash })
      return null
    },
    [bucket, schema, setSuccess, uploadPackage],
  )

  const onSubmitWeb = async ({ name, msg, files, meta, workflow }: SubmitWebArgs) => {
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

    const entries = FP.function.pipe(
      R.mergeLeft(files.added, files.existing),
      R.omit(Object.keys(files.deleted)),
      Object.entries,
      R.map(([path, file]) => ({
        logical_key: path,
        size: file.size,
      })),
    )

    const error = await validateEntries(entries)
    if (error && error.length) {
      setEntriesError(error)
      return {
        files: 'schema',
      }
    }

    let uploadedEntries
    try {
      uploadedEntries = await uploads.upload({
        files: toUpload,
        bucket,
        prefix: name,
        getMeta: (path) => files.existing[path]?.meta || files.added[path]?.meta,
      })
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Error uploading files:')
      // eslint-disable-next-line no-console
      console.error(e)
      return PD.mkFormError(PD.ERROR_MESSAGES.UPLOAD)
    }

    const s3Entries = FP.function.pipe(
      addedS3Entries,
      R.map(
        ({ path, file }) =>
          [path, { physicalKey: s3paths.handleToS3Url(file) }] as R.KeyValuePair<
            string,
            PartialPackageEntry
          >,
      ),
      R.fromPairs,
    )

    const allEntries = FP.function.pipe(
      files.existing,
      R.omit(Object.keys(files.deleted)),
      R.mergeLeft(uploadedEntries),
      R.mergeLeft(s3Entries),
      R.toPairs,
      R.map(([logicalKey, data]: [string, PartialPackageEntry]) => ({
        logicalKey,
        physicalKey: data.physicalKey,
        hash: data.hash ?? null,
        meta: data.meta ?? null,
        size: data.size ?? null,
      })),
      R.sortBy(R.prop('logicalKey')),
    )

    try {
      const res = await constructPackage({
        params: {
          bucket,
          name,
          message: msg,
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
          entries: allEntries,
        },
      })
      if (res.error) throw res.error
      if (!res.data) throw new Error('No data returned by the API')
      const r = res.data.packageConstruct
      switch (r.__typename) {
        case 'PackagePushSuccess':
          setSuccess({ name, hash: r.revision.hash })
          return
        case 'OperationError':
          return PD.mkFormError(r.message)
        case 'InvalidInput':
          return PD.mapInputErrors(r.errors, { 'src.entries': 'files' })
        default:
          assertNever(r)
      }
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error('Error creating manifest:')
      // eslint-disable-next-line no-console
      console.error(e)
      return PD.mkFormError(
        e.message ? `Unexpected error: ${e.message}` : PD.ERROR_MESSAGES.MANIFEST,
      )
    }
  }

  const onSubmitWrapped = async (args: SubmitWebArgs | SubmitElectronArgs) => {
    setSubmitting(true)
    try {
      if (desktop) {
        return await onSubmitElectron(args as SubmitElectronArgs)
      }
      return await onSubmitWeb(args as SubmitWebArgs)
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
      if (dirtyFields?.files) setEntriesError(null)
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

  // HACK: FIXME: it triggers name validation with correct workflow
  const [hideMeta, setHideMeta] = React.useState(false)

  // TODO: move useLocalFolder to its own component shared by Download and Upload
  const [defaultLocalFolder] = Download.useLocalFolder()

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
                  if (modified!.workflow && values.workflow !== selectedWorkflow) {
                    setWorkflow(values.workflow)

                    // HACK: FIXME: it triggers name validation with correct workflow
                    setHideMeta(true)
                    setTimeout(() => {
                      setHideMeta(false)
                    }, 300)
                  }
                }}
              />

              <Layout.Container>
                <Layout.LeftColumn>
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
                    workflow={selectedWorkflow || workflowsConfig}
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
                      pattern: `Name should match ${selectedWorkflow?.packageNamePattern}`,
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

                  {schemaLoading || hideMeta ? (
                    <MetaInputSkeleton className={classes.meta} ref={setEditorElement} />
                  ) : (
                    <RF.Field
                      className={classes.meta}
                      component={MI.MetaInput}
                      name="meta"
                      bucket={bucket}
                      schema={schema}
                      schemaError={responseError}
                      validate={validateMetaInput}
                      validateFields={['meta']}
                      isEqual={R.equals}
                      initialValue={initial?.meta || MI.EMPTY_META_VALUE}
                      ref={setEditorElement}
                    />
                  )}
                </Layout.LeftColumn>

                <Layout.RightColumn>
                  {desktop ? (
                    <RF.Field
                      className={cx(classes.files, {
                        [classes.filesWithError]: !!entriesError,
                      })}
                      component={Upload.LocalFolderInput}
                      initialValue={defaultLocalFolder}
                      name="localFolder"
                      title="Local directory"
                      errors={{
                        required: 'Add directory to create a package',
                      }}
                      validate={validators.required as FF.FieldValidator<string>}
                    />
                  ) : (
                    <RF.Field
                      className={cx(classes.files, {
                        [classes.filesWithError]: !!entriesError,
                      })}
                      // @ts-expect-error
                      component={FI.FilesInput}
                      name="files"
                      validate={validateFiles as FF.FieldValidator<$TSFixMe>}
                      validateFields={['files']}
                      errors={{
                        nonEmpty: 'Add files to create a package',
                        schema: 'Files should match schema',
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
                  )}

                  <JsonValidationErrors
                    className={classes.filesError}
                    error={entriesError}
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

const DialogState = tagged.create(
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
type DialogState = tagged.InstanceOf<typeof DialogState>

const EMPTY_MANIFEST_RESULT = AsyncResult.Ok()

interface PackageCreationDialogUIOptions {
  resetFiles?: React.ReactNode
  submit?: React.ReactNode
  successBrowse?: React.ReactNode
  successRenderMessage?: (props: DialogSuccessRenderMessageProps) => React.ReactNode
  successTitle?: React.ReactNode
  title?: React.ReactNode
}

interface UsePackageCreationDialogProps {
  bucket: string
  src?: {
    name: string
    hash?: string
  }
  delayHashing?: boolean
  disableStateDisplay?: boolean
}

export function usePackageCreationDialog({
  bucket,
  src,
  delayHashing = false,
  disableStateDisplay = false,
}: UsePackageCreationDialogProps) {
  const [isOpen, setOpen] = React.useState(false)
  const [exited, setExited] = React.useState(!isOpen)
  const [success, setSuccess] = React.useState<PackageCreationSuccess | false>(false)
  const [submitting, setSubmitting] = React.useState(false)
  const [workflow, setWorkflow] = React.useState<workflows.Workflow>()

  const s3 = AWS.S3.use()
  const workflowsData = Data.use(requests.workflowsConfig, { s3, bucket })
  // XXX: use AsyncResult
  const preferences = BucketPreferences.use()

  const manifestData = useManifest({
    bucket,
    // this only gets passed when src is defined, so it should be always non-null when the query gets executed
    name: src?.name!,
    hash: src?.hash,
    pause: !(src && isOpen),
  })

  const manifestResult = src ? manifestData.result : EMPTY_MANIFEST_RESULT

  // AsyncResult<Model.PackageContentsFlatMap | undefined>
  const data = React.useMemo(
    () =>
      workflowsData.case({
        Ok: (workflowsConfig: workflows.WorkflowsConfig) =>
          AsyncResult.case(
            {
              Ok: (manifest: Manifest | undefined) =>
                preferences
                  ? AsyncResult.Ok({
                      manifest,
                      workflowsConfig,
                      sourceBuckets: preferences.ui.sourceBuckets,
                    })
                  : AsyncResult.Pending(),
              _: R.identity,
            },
            manifestResult,
          ),
        _: R.identity,
      }),
    [workflowsData, manifestResult, preferences],
  )

  const open = React.useCallback(() => {
    setOpen(true)
    setExited(false)
  }, [setOpen, setExited])

  const close = React.useCallback(() => {
    if (submitting) return
    setOpen(false)
    setWorkflow(undefined) // TODO: is this necessary?
  }, [submitting, setOpen])

  const handleExited = React.useCallback(() => {
    setExited(true)
    setSuccess(false)
  }, [setExited, setSuccess])

  Intercom.usePauseVisibilityWhen(isOpen)

  const state = React.useMemo<DialogState>(() => {
    if (exited) return DialogState.Closed()
    if (success) return DialogState.Success(success)
    return AsyncResult.case(
      {
        Ok: DialogState.Form,
        Err: DialogState.Error,
        _: DialogState.Loading,
      },
      data,
    )
  }, [exited, success, data])

  const render = (ui: PackageCreationDialogUIOptions = {}) => (
    <PD.DialogWrapper
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
              initialWorkflowId={manifest?.workflowId}
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
                    initial: { name: src?.name, ...manifest },
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

  return { open, close, render }
}
