import type { ErrorObject } from 'ajv'
import cx from 'classnames'
import * as FF from 'final-form'
import * as FP from 'fp-ts'
import * as R from 'ramda'
import * as React from 'react'
import * as RF from 'react-final-form'
import useResizeObserver from 'use-resize-observer'
import * as M from '@material-ui/core'

import * as Intercom from 'components/Intercom'
import JsonValidationErrors from 'components/JsonValidationErrors'
import cfg from 'constants/config'
import * as AddToPackage from 'containers/AddToPackage'
import type * as Model from 'model'
import * as AWS from 'utils/AWS'
import AsyncResult from 'utils/AsyncResult'
import * as BucketPreferences from 'utils/BucketPreferences'
import * as Data from 'utils/Data'
import * as Dialogs from 'utils/Dialogs'
import { useMutation } from 'utils/GraphQL'
import assertNever from 'utils/assertNever'
import { mkFormError, mapInputErrors } from 'utils/formTools'
import * as s3paths from 'utils/s3paths'
import * as tagged from 'utils/taggedV2'
import * as Types from 'utils/types'
import * as validators from 'utils/validators'
import * as workflows from 'utils/workflows'

import * as Download from '../Download'
import * as Selection from '../Selection'
import * as Successors from '../Successors'
import * as Upload from '../Upload'
import * as requests from '../requests'

import DialogError from './DialogError'
import DialogLoading from './DialogLoading'
import DialogSuccess, { DialogSuccessRenderMessageProps } from './DialogSuccess'
import * as FI from './FilesInput'
import * as Layout from './Layout'
import * as MI from './MetaInput'
import * as PD from './PackageDialog'
import { isS3File } from './S3FilePicker'
import { FormSkeleton, MetaInputSkeleton } from './Skeleton'
import SubmitSpinner from './SubmitSpinner'
import { useUploads } from './Uploads'
import PACKAGE_CONSTRUCT from './gql/PackageConstruct.generated'
import { Manifest, EMPTY_MANIFEST_ENTRIES, useManifest } from './Manifest'

const CANCEL = 'cancel'
const README_PATH = 'README.md'

type PartialPackageEntry = Types.AtLeast<Model.PackageEntry, 'physicalKey'>

// TODO: use tree as the main data model / source of truth?
export interface LocalEntry {
  path: string
  file: FI.LocalFile
}

export interface S3Entry {
  path: string
  file: Model.S3File
}

export interface PackageCreationSuccess {
  name: string
  hash?: string
}

// Convert FilesState to entries consumed by Schema validation
function filesStateToEntries(files: FI.FilesState): PD.ValidationEntry[] {
  return FP.function.pipe(
    R.mergeLeft(files.added, files.existing),
    R.omit(Object.keys(files.deleted)),
    Object.entries,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    R.filter(([path, file]) => file !== FI.EMPTY_DIR_MARKER),
    R.map(([path, file]) => ({
      logical_key: path,
      meta: file.meta?.user_meta || {},
      size: file.size,
    })),
  )
}

function createReadmeFile(name: string) {
  const contents = [
    `# ${name}`,
    '\n\n',
    `Stub README for the **${name}** package generated by Quilt Catalog`,
    '\n',
  ]
  const f = new File(contents, README_PATH, { type: 'text/markdown' })
  return FI.computeHash(f) as FI.LocalFile
}

interface ConfirmReadmeProps {
  close: Dialogs.Close<'cancel' | 'empty' | 'readme'>
}

function ConfirmReadme({ close }: ConfirmReadmeProps) {
  return (
    <>
      <M.DialogTitle>Add a README file?</M.DialogTitle>
      <M.DialogContent>
        <M.DialogContentText>
          You are about to push an empty package.
          <br />
          Would you like to add a stub <b>README.md</b> file?
        </M.DialogContentText>
      </M.DialogContent>
      <M.DialogActions>
        <M.Button onClick={() => close('cancel')} color="primary">
          Cancel
        </M.Button>
        <M.Button onClick={() => close('empty')} color="primary" variant="outlined">
          Continue with empty package
        </M.Button>
        <M.Button onClick={() => close('readme')} color="primary" variant="contained">
          Add README.md
        </M.Button>
      </M.DialogActions>
    </>
  )
}

interface FormErrorProps {
  submitting: boolean
  error: React.ReactNode
}

function FormError({ submitting, error }: FormErrorProps) {
  if (submitting || !error || error === CANCEL) return null
  return (
    <M.Box flexGrow={1} display="flex" alignItems="center" pl={2}>
      <M.Icon color="error">error_outline</M.Icon>
      <M.Box pl={1} />
      <M.Typography variant="body2" color="error">
        {error}
      </M.Typography>
    </M.Box>
  )
}

const useStyles = M.makeStyles((t) => ({
  files: {
    height: '100%',
    overflowY: 'auto',
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
  successor: workflows.Successor
  onSuccessor: (successor: workflows.Successor) => void
  setSubmitting: (submitting: boolean) => void
  setSuccess: (success: PackageCreationSuccess) => void
  setWorkflow: (workflow: workflows.Workflow) => void
  sourceBuckets: BucketPreferences.SourceBuckets
  workflowsConfig: workflows.WorkflowsConfig
  currentBucketCanBeSuccessor: boolean
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
  successor,
  onSuccessor,
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
  currentBucketCanBeSuccessor,
  delayHashing,
  disableStateDisplay,
  ui = {},
}: PackageCreationFormProps & PD.SchemaFetcherRenderProps) {
  const addToPackage = AddToPackage.use()
  const nameValidator = PD.useNameValidator(selectedWorkflow)
  const nameExistence = PD.useNameExistence(successor.slug)
  const [nameWarning, setNameWarning] = React.useState<React.ReactNode>('')
  const classes = useStyles()
  const [editorElement, setEditorElement] = React.useState<HTMLDivElement | null>(null)
  const { height: metaHeight = 0 } = useResizeObserver({ ref: editorElement })
  const dialogContentClasses = PD.useContentStyles({ metaHeight })
  const validateWorkflow = PD.useWorkflowValidator(workflowsConfig)

  const dialogs = Dialogs.use()

  const [entriesError, setEntriesError] = React.useState<(Error | ErrorObject)[] | null>(
    null,
  )

  const [selectedBucket, selectBucket] = React.useState(sourceBuckets.getDefault)

  const existingEntries = initial?.entries ?? EMPTY_MANIFEST_ENTRIES

  const initialFiles: FI.FilesState = React.useMemo(
    () => ({
      existing: existingEntries,
      added: addToPackage?.entries || {},
      deleted: {},
    }),
    [existingEntries, addToPackage],
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

  const constructPackage = useMutation(PACKAGE_CONSTRUCT)
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
      const uploadResult = await uploadPackage(
        payload,
        { name, bucket: successor.slug },
        schema,
      )
      setSuccess({ name, hash: uploadResult?.hash })
      return null
    },
    [successor.slug, schema, setSuccess, uploadPackage],
  )

  const onSubmitWeb = async ({ name, msg, files, meta, workflow }: SubmitWebArgs) => {
    const addedS3Entries: S3Entry[] = []
    const addedLocalEntries: LocalEntry[] = []
    Object.entries(files.added).forEach(([path, file]) => {
      if (file === FI.EMPTY_DIR_MARKER) return
      if (isS3File(file)) {
        addedS3Entries.push({ path, file })
      } else {
        addedLocalEntries.push({ path, file })
      }
    })

    const toUpload = addedLocalEntries.filter(({ path, file }) => {
      const e = files.existing[path]
      return !e || !R.equals(e.hash, file.hash.value)
    })

    const entries = filesStateToEntries(files)

    if (!entries.length) {
      const reason = await dialogs.open<'cancel' | 'empty' | 'readme'>((props) => (
        <ConfirmReadme {...props} />
      ))
      if (reason === 'cancel') return mkFormError(CANCEL)
      if (reason === 'readme') {
        const file = createReadmeFile(name)
        entries.push({ logical_key: README_PATH, size: file.size, meta: {} })
        toUpload.push({ path: README_PATH, file })
      }
    }

    const error = await validateEntries(entries)
    if (error?.length) {
      setEntriesError(error)
      return {
        files: 'schema',
      }
    }

    let uploadedEntries
    try {
      uploadedEntries = await uploads.upload({
        files: toUpload,
        bucket: successor.slug,
        prefix: name,
        getMeta: (path) => files.existing[path]?.meta || files.added[path]?.meta,
      })
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Error uploading files:')
      // eslint-disable-next-line no-console
      console.error(e)
      return mkFormError(PD.ERROR_MESSAGES.UPLOAD)
    }

    const s3Entries = FP.function.pipe(
      addedS3Entries,
      R.map(
        ({ path, file }) =>
          [
            path,
            { physicalKey: s3paths.handleToS3Url(file), meta: file.meta },
          ] as R.KeyValuePair<string, PartialPackageEntry>,
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
      const { packageConstruct: r } = await constructPackage({
        params: {
          bucket: successor.slug,
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
      switch (r.__typename) {
        case 'PackagePushSuccess':
          setSuccess({ name, hash: r.revision.hash })
          return
        case 'OperationError':
          return mkFormError(r.message)
        case 'InvalidInput':
          return mapInputErrors(r.errors, { 'src.entries': 'files' })
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

  const onSubmitWrapped = async (args: SubmitWebArgs | SubmitElectronArgs) => {
    setSubmitting(true)
    try {
      if (cfg.desktop) {
        return await onSubmitElectron(args as SubmitElectronArgs)
      }
      return await onSubmitWeb(args as SubmitWebArgs)
    } finally {
      addToPackage?.clear()
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

  const onFormChange = React.useCallback(
    ({ dirtyFields, values }) => {
      if (dirtyFields?.name) handleNameChange(values.name)
    },
    [handleNameChange],
  )

  const validateFiles = React.useCallback(
    async (files: FI.FilesState) => {
      const hashihgError = delayHashing && FI.validateHashingComplete(files)
      if (hashihgError) return hashihgError

      const entries = filesStateToEntries(files)
      const errors = await validateEntries(entries)
      setEntriesError(errors || null)
      if (errors?.length) {
        return 'schema'
      }
    },
    [delayHashing, validateEntries],
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
          {dialogs.render({ fullWidth: true, maxWidth: 'sm' })}
          <M.DialogTitle>
            {ui.title || 'Create package'} in{' '}
            <Successors.Dropdown
              bucket={bucket || ''}
              currentBucketCanBeSuccessor={currentBucketCanBeSuccessor}
              successor={successor}
              onChange={onSuccessor}
            />{' '}
            bucket
          </M.DialogTitle>
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
                  {cfg.desktop ? (
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
                      validationErrors={
                        submitFailed ? entriesError : PD.EMPTY_ENTRIES_ERRORS
                      }
                    />
                  )}

                  <JsonValidationErrors
                    className={classes.filesError}
                    error={submitFailed ? entriesError : []}
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

            <FormError submitting={submitting} error={error || submitError} />

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

function prependSourceBucket(
  buckets: BucketPreferences.SourceBuckets,
  bucket: string,
): BucketPreferences.SourceBuckets {
  return {
    getDefault: () => bucket,
    list: R.prepend(bucket, buckets.list),
  }
}

const DialogState = tagged.create(
  'app/containers/Bucket/PackageDialog/PackageCreationForm:DialogState' as const,
  {
    Closed: () => {},
    Loading: (opts?: { waitListing?: boolean }) => opts,
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
  s3Path?: string
  initialOpen?: boolean
  delayHashing?: boolean
  disableStateDisplay?: boolean
}

// TODO: package can be created from some `src`:
//         * s3 directory
//         * existing package
//       and pushed to `dst` (or maybe just `successor`):
//         * successor
export function usePackageCreationDialog({
  bucket, // TODO: put it to dst; and to src if needed (as PackageHandle)
  src,
  initialOpen,
  s3Path,
  delayHashing = false,
  disableStateDisplay = false,
}: UsePackageCreationDialogProps) {
  const [isOpen, setOpen] = React.useState(initialOpen || false)
  const [exited, setExited] = React.useState(!isOpen)
  const [success, setSuccess] = React.useState<PackageCreationSuccess | false>(false)
  const [submitting, setSubmitting] = React.useState(false)
  const [workflow, setWorkflow] = React.useState<workflows.Workflow>()
  // TODO: move to props: { dst: { successor }, onSuccessorChange }
  const [successor, setSuccessor] = React.useState(workflows.bucketToSuccessor(bucket))
  const currentBucketCanBeSuccessor = s3Path !== undefined
  const addToPackage = AddToPackage.use()

  const s3 = AWS.S3.use()
  const workflowsData = Data.use(
    requests.workflowsConfig,
    { s3, bucket: successor.slug },
    { noAutoFetch: !bucket },
  )
  const prefs = BucketPreferences.use()

  const manifestData = useManifest({
    bucket,
    // this only gets passed when src is defined, so it should be always non-null when the query gets executed
    name: src?.name!,
    hashOrTag: src?.hash,
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
                BucketPreferences.Result.match(
                  {
                    Ok: ({ ui: { sourceBuckets } }) =>
                      AsyncResult.Ok({
                        manifest,
                        workflowsConfig,
                        sourceBuckets:
                          s3Path === undefined
                            ? sourceBuckets
                            : prependSourceBucket(sourceBuckets, bucket),
                      }),
                    Pending: AsyncResult.Pending,
                    Init: AsyncResult.Init,
                  },
                  prefs,
                ),

              _: R.identity,
            },
            manifestResult,
          ),
        _: R.identity,
      }),
    [bucket, s3Path, workflowsData, manifestResult, prefs],
  )

  const [waitingListing, setWaitingListing] = React.useState(false)
  const getFiles = requests.useFilesListing()

  const open = React.useCallback(
    async (initial?: {
      successor?: workflows.Successor
      path?: string
      selection?: Selection.ListingSelection
    }) => {
      if (initial?.successor) {
        setSuccessor(initial?.successor)
      }

      setWaitingListing(true)
      setOpen(true)
      setExited(false)

      if (!initial?.selection) {
        setWaitingListing(false)
        return
      }
      const handles = Selection.toHandlesList(initial?.selection)
      const filesMap = await getFiles(handles)
      addToPackage?.merge(filesMap)
      setWaitingListing(false)
    },
    [addToPackage, getFiles],
  )

  const close = React.useCallback(() => {
    if (submitting) return
    setOpen(false)
    setWorkflow(undefined) // TODO: is this necessary?
    addToPackage?.clear()
  }, [addToPackage, submitting, setOpen])

  const handleExited = React.useCallback(() => {
    setExited(true)
    setSuccess(false)
  }, [setExited, setSuccess])

  Intercom.usePauseVisibilityWhen(isOpen)

  const state = React.useMemo<DialogState>(() => {
    if (exited) return DialogState.Closed()
    if (success) return DialogState.Success(success)
    if (waitingListing) {
      return DialogState.Loading({
        waitListing: true,
      })
    }
    return AsyncResult.case(
      {
        Ok: DialogState.Form,
        Err: DialogState.Error,
        _: DialogState.Loading,
      },
      data,
    )
  }, [waitingListing, exited, success, data])

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
          Loading: (opts) => (
            <DialogLoading
              skeletonElement={<FormSkeleton />}
              title={
                opts?.waitListing
                  ? 'Fetching list of files inside selected directories. It can take a while…'
                  : 'Fetching package manifest. One moment…'
              }
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
                    successor,
                    close,
                    setSubmitting,
                    setSuccess,
                    setWorkflow,
                    workflowsConfig,
                    sourceBuckets,
                    initial: {
                      name: src?.name,
                      ...manifest,
                    },
                    currentBucketCanBeSuccessor,
                    delayHashing,
                    disableStateDisplay,
                    onSuccessor: setSuccessor,
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
              bucket={successor.slug}
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
