// import type { ErrorObject } from 'ajv'
import cx from 'classnames'
// import * as FF from 'final-form'
// import * as FP from 'fp-ts'
// import * as R from 'ramda'
import * as React from 'react'
// import * as RF from 'react-final-form'
import useResizeObserver from 'use-resize-observer'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import * as Intercom from 'components/Intercom'
// import JsonValidationErrors from 'components/JsonValidationErrors'
// import cfg from 'constants/config'
// import * as AddToPackage from 'containers/AddToPackage'
// import type * as Model from 'model'
// import * as AWS from 'utils/AWS'
// import AsyncResult from 'utils/AsyncResult'
// import * as BucketPreferences from 'utils/BucketPreferences'
// import * as Data from 'utils/Data'
import * as Dialogs from 'utils/Dialogs'
// import { useMutation } from 'utils/GraphQL'
// import assertNever from 'utils/assertNever'
// import { mkFormError, mapInputErrors } from 'utils/formTools'
// import * as s3paths from 'utils/s3paths'
import * as tagged from 'utils/taggedV2'
// import * as Types from 'utils/types'
// import * as validators from 'utils/validators'
import * as workflows from 'utils/workflows'

import * as Selection from '../Selection'
import * as Successors from '../Successors'
import * as requests from '../requests'

import DialogError from './DialogError'
import DialogLoading from './DialogLoading'
import DialogSuccess, { DialogSuccessRenderMessageProps } from './DialogSuccess'
import * as FI from './FilesInput'
import * as Layout from './Layout'
import * as MI from './MetaInput'
import * as PD from './PackageDialog'
import SelectWorkflow from './SelectWorkflow'
import * as State from './state'
import { FormSkeleton, MetaInputSkeleton } from './Skeleton'
import SubmitSpinner from './SubmitSpinner'
import { useUploads } from './Uploads'
// import PACKAGE_CONSTRUCT from './gql/PackageConstruct.generated'
// import { Manifest, useManifest } from './Manifest'

function InputWorkflow() {
  const {
    values: {
      workflow: { status, value, onChange },
    },
    schema,
    workflowsConfig,
  } = State.use()
  const error = React.useMemo(() => {
    if (workflowsConfig._tag === 'error') return workflowsConfig.error.message
    if (status._tag === 'error') return status.error.message
    return undefined
  }, [status, workflowsConfig])
  if (workflowsConfig._tag === 'idle') return null
  if (workflowsConfig._tag === 'loading') {
    return (
      <M.FormControl fullWidth size="small">
        <M.InputLabel shrink>
          <Lab.Skeleton width={120} />
        </M.InputLabel>
        <Lab.Skeleton
          width="100%"
          variant="rect"
          style={{ marginTop: '16px', height: '32px' }}
        />
        <M.FormHelperText>
          <Lab.Skeleton width={240} />
        </M.FormHelperText>
      </M.FormControl>
    )
  }
  // FIXME: disabled when on submit
  return (
    <SelectWorkflow
      disabled={schema._tag === 'loading'}
      error={error}
      items={workflowsConfig.config.workflows}
      onChange={onChange}
      value={value}
    />
  )
}

function InputName() {
  const {
    values: {
      name: { value, onChange, status },
    },
  } = State.use()
  const handleChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => onChange(event.target.value),
    [onChange],
  )
  return (
    <M.TextField
      /*style*/
      InputLabelProps={{ shrink: true }}
      fullWidth
      margin="normal"
      /*constants*/
      helperText={<PD.PackageNameWarning />}
      error={status._tag === 'error'}
      label="Name"
      placeholder="e.g. user/package"
      /*data*/
      onChange={handleChange}
      value={value || ''}
    />
  )
}

function InputMessage() {
  const {
    values: {
      message: { status, value, onChange },
    },
  } = State.use()
  const handleChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => onChange(event.target.value),
    [onChange],
  )
  return (
    <M.TextField
      /*style*/
      InputLabelProps={{ shrink: true }}
      fullWidth
      margin="normal"
      /*constants*/
      label="Message"
      placeholder="Enter a commit message"
      /*data*/
      onChange={handleChange}
      value={value || ''}
      helperText={status._tag === 'error' && status.error.message}
      error={status._tag === 'error'}
    />
  )
}

const useInputMetaStyles = M.makeStyles((t) => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    paddingTop: t.spacing(3),
    overflowY: 'auto',
  },
}))

const InputMeta = React.forwardRef<HTMLDivElement>(function InputMeta(_, ref) {
  const classes = useInputMetaStyles()
  const {
    values: {
      meta: { status, value, onChange },
    },
    formStatus,
    schema,
  } = State.use()
  const errors = React.useMemo(() => {
    if (schema._tag === 'error') return [schema.error]
    if (status._tag === 'error') return status.errors
    return []
  }, [schema, status])
  if (schema._tag === 'loading') {
    return <MetaInputSkeleton ref={ref} className={classes.root} />
  }
  return (
    <MI.MetaInput
      disabled={formStatus._tag === 'submitting' || formStatus._tag === 'success'}
      className={classes.root}
      errors={errors}
      onChange={onChange}
      ref={ref}
      schema={schema._tag === 'ready' ? schema.schema : undefined}
      value={value}
    />
  )
})

const useInputFilesStyles = M.makeStyles((t) => ({
  root: {
    height: '100%',
    overflowY: 'auto',
  },
  error: {
    height: `calc(90% - ${t.spacing()}px)`,
  },
}))

function InputFiles() {
  const classes = useInputFilesStyles()
  const {
    values: {
      files: { initial, status, value, onChange },
    },
    formStatus,
  } = State.use()
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
  return (
    <FI.FilesInput
      disabled={formStatus._tag === 'submitting' || formStatus._tag === 'success'}
      className={cx(classes.root, { [classes.error]: status._tag === 'error' })}
      value={value}
      initial={initial}
      onChange={onChange}
      error={status._tag === 'error' ? status.error : undefined}
      errors={status._tag === 'error' ? status.errors : undefined}
      title="Files"
      totalProgress={uploads.progress}
      onFilesAction={onFilesAction}
    />
  )
}

// const CANCEL = 'cancel'
// const README_PATH = 'README.md'
//
// type PartialPackageEntry = Types.AtLeast<Model.PackageEntry, 'physicalKey'>
//
export interface PackageCreationSuccess {
  name: string
  hash?: string
}
//
// // Convert FilesState to entries consumed by Schema validation
// function filesStateToEntries(files: FI.FilesState): PD.ValidationEntry[] {
//   return FP.function.pipe(
//     R.mergeLeft(files.added, files.existing),
//     R.omit(Object.keys(files.deleted)),
//     Object.entries,
//     R.filter(([, file]) => file !== FI.EMPTY_DIR_MARKER),
//     R.map(([path, file]) => ({
//       logical_key: path,
//       meta: file.meta?.user_meta || {},
//       size: file.size,
//     })),
//   )
// }

// function createReadmeFile(name: string) {
//   const contents = [
//     `# ${name}`,
//     '\n\n',
//     `Stub README for the **${name}** package generated by Quilt Catalog`,
//     '\n',
//   ]
//   const f = new File(contents, README_PATH, { type: 'text/markdown' })
//   return FI.computeHash(f) as FI.LocalFile
// }

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
  error: Error
}

function FormError({ error }: FormErrorProps) {
  // if (!error || error === CANCEL) return null
  return (
    <M.Box flexGrow={1} display="flex" alignItems="center" pl={2}>
      <M.Icon color="error">error_outline</M.Icon>
      <M.Box pl={1} />
      <M.Typography variant="body2" color="error">
        {error.message}
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
  // initial?: {
  //   name?: string
  //   meta?: Types.JsonRecord
  //   workflowId?: string
  //   entries?: Model.PackageContentsFlatMap
  // }
  // successor: workflows.Successor
  // onSuccessor: (successor: workflows.Successor) => void
  // setSubmitting: (submitting: boolean) => void
  // setSuccess: (success: PackageCreationSuccess) => void
  // setWorkflow: (workflow: workflows.Workflow) => void
  // sourceBuckets: BucketPreferences.SourceBuckets
  // workflowsConfig: workflows.WorkflowsConfig
  currentBucketCanBeSuccessor: boolean
  // delayHashing: boolean
  disableStateDisplay: boolean
  ui?: {
    title?: React.ReactNode
    submit?: React.ReactNode
    resetFiles?: React.ReactNode
  }
}

function PackageCreationForm(
  {
    bucket,
    close,
    // initial,
    // successor,
    // onSuccessor,
    // responseError,
    // schema,
    // schemaLoading,
    // selectedWorkflow,
    // setSubmitting,
    // setSuccess,
    // setWorkflow,
    // sourceBuckets,
    // validate: validateMetaInput,
    // workflowsConfig,
    currentBucketCanBeSuccessor,
    // delayHashing,
    // disableStateDisplay,
    ui = {},
  }: PackageCreationFormProps /*& PD.SchemaFetcherRenderProps*/,
) {
  // const addToPackage = AddToPackage.use()
  // const nameValidator = PD.useNameValidator(selectedWorkflow)
  const { formData, formStatus, dst, setDst, submit, progress, onAddReadme } = State.use()
  const classes = useStyles()
  const [editorElement, setEditorElement] = React.useState<HTMLDivElement | null>(null)
  const { height: metaHeight = 0 } = useResizeObserver({ ref: editorElement })
  const dialogContentClasses = PD.useContentStyles({ metaHeight })
  // const validateWorkflow = PD.useWorkflowValidator(workflowsConfig)

  // const dialogs = Dialogs.use()

  // const [entriesError, setEntriesError] = React.useState<(Error | ErrorObject)[] | null>(
  //   null,
  // )

  // const existingEntries = initial?.entries ?? EMPTY_MANIFEST_ENTRIES

  // const initialFiles: FI.FilesState = React.useMemo(
  //   () => ({
  //     existing: existingEntries,
  //     added: addToPackage?.entries || {},
  //     deleted: {},
  //   }),
  //   [existingEntries, addToPackage],
  // )

  // const uploads = useUploads()

  // const onFilesAction = React.useMemo(
  //   () =>
  //     FI.FilesAction.match({
  //       _: () => {},
  //       Revert: uploads.remove,
  //       RevertDir: uploads.removeByPrefix,
  //       Reset: uploads.reset,
  //     }),
  //   [uploads],
  // )

  // const constructPackage = useMutation(PACKAGE_CONSTRUCT)
  // const validateEntries = PD.useEntriesValidator(selectedWorkflow)

  // interface SubmitArgs {
  //   name: string
  //   msg: string
  //   meta: {}
  //   localFolder?: string
  //   workflow: workflows.Workflow
  // }
  // interface SubmitWebArgs extends SubmitArgs {
  //   files: FI.FilesState
  // }
  // interface SubmitElectronArgs extends SubmitArgs {
  //   localFolder: string
  // }

  // const onSubmit = async ({ files, meta }: SubmitWebArgs) => {
  //   if (!values.name.value) return 'name'
  //   if (!values.message.value) return 'message'
  //   if (!values.workflow.value) return 'workflow'
  //   if (schema._tag !== 'ready') return 'meta'

  //   const { local: addedLocalEntries, remote: addedS3Entries } = FI.groupAddedFiles(
  //     files.added,
  //   )

  //   const toUpload = addedLocalEntries.filter(({ path, file }) => {
  //     const e = files.existing[path]
  //     return !e || !R.equals(e.hash, file.hash.value)
  //   })

  //   const entries = filesStateToEntries(files)

  //   if (!entries.length) {
  //     const reason = await dialogs.open<'cancel' | 'empty' | 'readme'>((props) => (
  //       <ConfirmReadme {...props} />
  //     ))
  //     if (reason === 'cancel') return mkFormError(CANCEL)
  //     if (reason === 'readme') {
  //       const file = createReadmeFile(values.name.value)
  //       entries.push({ logical_key: README_PATH, size: file.size, meta: {} })
  //       toUpload.push({ path: README_PATH, file })
  //     }
  //   }

  //   // const error = await validateEntries(entries)
  //   // if (error?.length) {
  //   //   setEntriesError(error)
  //   //   return {
  //   //     files: 'schema',
  //   //   }
  //   // }

  //   let uploadedEntries
  //   try {
  //     uploadedEntries = await uploads.upload({
  //       files: toUpload,
  //       bucket: successor.slug,
  //       getCanonicalKey: (path) => {
  //         if (!values.name.value) {
  //           throw new Error('Package name is required')
  //         }
  //         return s3paths.canonicalKey(values.name.value, path, cfg.packageRoot)
  //       },
  //       getMeta: (path) => files.existing[path]?.meta || files.added[path]?.meta,
  //     })
  //   } catch (e) {
  //     // eslint-disable-next-line no-console
  //     console.error('Error uploading files:')
  //     // eslint-disable-next-line no-console
  //     console.error(e)
  //     return mkFormError(PD.ERROR_MESSAGES.UPLOAD)
  //   }

  //   const s3Entries = FP.function.pipe(
  //     addedS3Entries,
  //     R.map(
  //       ({ path, file }) =>
  //         [
  //           path,
  //           { physicalKey: s3paths.handleToS3Url(file), meta: file.meta },
  //         ] as R.KeyValuePair<string, PartialPackageEntry>,
  //     ),
  //     R.fromPairs,
  //   )

  //   const allEntries = FP.function.pipe(
  //     files.existing,
  //     R.omit(Object.keys(files.deleted)),
  //     R.mergeLeft(uploadedEntries),
  //     R.mergeLeft(s3Entries),
  //     R.toPairs,
  //     R.map(([logicalKey, data]: [string, PartialPackageEntry]) => ({
  //       logicalKey,
  //       physicalKey: data.physicalKey,
  //       hash: data.hash ?? null,
  //       meta: data.meta ?? null,
  //       size: data.size ?? null,
  //     })),
  //     R.sortBy(R.prop('logicalKey')),
  //   )

  //   try {
  //     const { packageConstruct: r } = await constructPackage({
  //       params: {
  //         bucket: successor.slug,
  //         name: values.name.value,
  //         message: values.message.value,
  //         userMeta: requests.getMetaValue(meta, schema.schema) ?? null,
  //         workflow:
  //           // eslint-disable-next-line no-nested-ternary
  //           values.workflow.value.slug === workflows.notAvailable
  //             ? null
  //             : values.workflow.value.slug === workflows.notSelected
  //               ? ''
  //               : values.workflow.value.slug,
  //       },
  //       src: {
  //         entries: allEntries,
  //       },
  //     })
  //     switch (r.__typename) {
  //       case 'PackagePushSuccess':
  //         setSuccess({ name: values.name.value, hash: r.revision.hash })
  //         return
  //       case 'OperationError':
  //         return mkFormError(r.message)
  //       case 'InvalidInput':
  //         return mapInputErrors(r.errors, { 'src.entries': 'files' })
  //       default:
  //         assertNever(r)
  //     }
  //   } catch (e: any) {
  //     // eslint-disable-next-line no-console
  //     console.error('Error creating manifest:')
  //     // eslint-disable-next-line no-console
  //     console.error(e)
  //     return mkFormError(
  //       e.message ? `Unexpected error: ${e.message}` : PD.ERROR_MESSAGES.MANIFEST,
  //     )
  //   }
  // }

  // const onSubmitWrapped = async (args: SubmitWebArgs | SubmitElectronArgs) => {
  //   // setSubmitting(true)
  //   // try {
  //   //   return await onSubmit(args as SubmitWebArgs)
  //   // } finally {
  //   //   // addToPackage?.clear()
  //   //   setSubmitting(false)
  //   // }
  // }

  // const onFormChange = React.useCallback(
  //   ({ dirtyFields, values }) => {
  //     if (dirtyFields?.name) name.onChange(values.name)
  //     if (dirtyFields?.workflow) workflow.onChange(values.name)
  //   },
  //   [name, workflow],
  // )

  // const validateFiles = React.useCallback(
  //   async (files: FI.FilesState) => {
  //     const hashihgError = delayHashing && FI.validateHashingComplete(files)
  //     if (hashihgError) return hashihgError

  //     const entries = filesStateToEntries(files)
  //     const errors = await validateEntries(entries)
  //     // setEntriesError(errors || null)
  //     if (errors?.length) {
  //       return 'schema'
  //     }
  //   },
  //   [delayHashing, validateEntries],
  // )

  // HACK: FIXME: it triggers name validation with correct workflow
  // const [hideMeta, setHideMeta] = React.useState(false)

  const successor = React.useMemo(() => workflows.bucketToSuccessor(dst.bucket), [dst])
  const handleSubmit = React.useCallback(
    (event) => {
      event.preventDefault()
      submit()
    },
    [submit],
  )

  return (
    // <RF.Form
    //   onSubmit={submit}
    //   subscription={{
    //     error: true,
    //     hasValidationErrors: true,
    //     submitError: true,
    //     submitFailed: true,
    //     submitting: true,
    //   }}
    //   validate={PD.useCryptoApiValidation()}
    // >
    //   {({
    //     // error,
    //     // hasValidationErrors,
    //     // submitError,
    //     // submitFailed,
    //     // submitting,
    //     // handleSubmit,
    //   }) => (
    <>
      {formStatus._tag === 'emptyFiles' && (
        <M.Dialog open fullWidth maxWidth="sm">
          <ConfirmReadme close={onAddReadme} />
        </M.Dialog>
      )}

      {/*dialogs.render({ fullWidth: true, maxWidth: 'sm' })*/}

      <M.DialogTitle>
        {ui.title || 'Create package'} in{' '}
        <Successors.Dropdown
          bucket={bucket || ''}
          currentBucketCanBeSuccessor={currentBucketCanBeSuccessor}
          successor={successor}
          onChange={(s) => setDst((d) => ({ ...d, bucket: s.slug }))}
        />{' '}
        bucket
      </M.DialogTitle>
      <M.DialogContent classes={dialogContentClasses}>
        <form className={classes.form} onSubmit={handleSubmit}>
          {/*
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
              */}

          <Layout.Container>
            <Layout.LeftColumn>
              <InputWorkflow />
              <InputName />
              <InputMessage />
              <InputMeta ref={setEditorElement} />
            </Layout.LeftColumn>
            <Layout.RightColumn>
              <InputFiles />
            </Layout.RightColumn>

            {/*
                <Layout.LeftColumn>
                  <InputWorkflow />
                  <InputName />
                  <InputMessage />
                  <InputMeta />

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
                    errors={{
                      required: 'Enter a package name',
                      invalid: 'Invalid package name',
                      pattern: `Name should match ${selectedWorkflow?.packageNamePattern}`,
                    }}
                    helperText={<PD.PackageNameWarning />}
                    initialValue={initial?.name}
                    name="name"
                    workflow={selectedWorkflow || workflowsConfig}
                    validate={validators.composeAsync(
                      validators.required,
                      nameValidator.validate,
                    )}
                    validateFields={['name']}
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
                  <RF.Field
                    className={cx(classes.files, {
                      [classes.filesWithError]: submitFailed && !!entriesError,
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
                    sourceBuckets={sourceBuckets}
                    delayHashing={delayHashing}
                    disableStateDisplay={disableStateDisplay}
                    ui={{ reset: ui.resetFiles }}
                    validationErrors={
                      submitFailed ? entriesError : PD.EMPTY_ENTRIES_ERRORS
                    }
                  />

                  <JsonValidationErrors
                    className={classes.filesError}
                    error={submitFailed ? entriesError : []}
                  />
                </Layout.RightColumn>
                  */}
          </Layout.Container>

          <input type="submit" style={{ display: 'none' }} />
        </form>
      </M.DialogContent>
      <M.DialogActions>
        {formStatus._tag === 'submitting' && (
          <SubmitSpinner value={progress.percent}>
            {progress.percent < 100 ? 'Uploading files' : 'Writing manifest'}
          </SubmitSpinner>
        )}

        {formStatus._tag === 'submitFailed' && !!formStatus.error && (
          <FormError error={formStatus.error} />
        )}

        <M.Button onClick={close} disabled={formStatus._tag === 'submitting'}>
          Cancel
        </M.Button>
        <M.Button
          onClick={handleSubmit}
          variant="contained"
          color="primary"
          disabled={formData._tag === 'invalid' || formStatus._tag === 'submitting'}
        >
          {ui.submit || 'Create'}
        </M.Button>
      </M.DialogActions>
    </>
    //    )}
    //  </RF.Form>
  )
}

// const prependSourceBucket = (
//   buckets: BucketPreferences.SourceBuckets,
//   bucket: string,
// ): BucketPreferences.SourceBuckets =>
//   buckets.list.find((b) => b === bucket)
//     ? buckets
//     : {
//         getDefault: () => bucket,
//         list: R.prepend(bucket, buckets.list),
//       }

const DialogState = tagged.create(
  'app/containers/Bucket/PackageDialog/PackageCreationForm:DialogState' as const,
  {
    Closed: () => {},
    Loading: (opts?: { waitListing?: boolean }) => opts,
    Error: (e: Error) => e,
    Form: (/*v: {
      manifest?: Manifest
      workflowsConfig: workflows.WorkflowsConfig
      sourceBuckets: BucketPreferences.SourceBuckets
    }*/) => /*v*/ {},
    Success: (v: PackageCreationSuccess) => v,
  },
)

// eslint-disable-next-line @typescript-eslint/no-redeclare
type DialogState = tagged.InstanceOf<typeof DialogState>

// const EMPTY_MANIFEST_RESULT = AsyncResult.Ok()

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
  s3Path?: string
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
  s3Path,
  // delayHashing = false,
  disableStateDisplay = false,
}: UsePackageCreationDialogProps) {
  const {
    formStatus,
    dst,
    setDst,
    reset,
    open: isOpen,
    setOpen,
    workflowsConfig,
  } = State.use()

  const [exited, setExited] = React.useState(!isOpen)
  // const [success, setSuccess] = React.useState<PackageCreationSuccess | false>(false)
  // const [submitting, setSubmitting] = React.useState(false)
  // const [workflow, setWorkflow] = React.useState<workflows.Workflow>()
  // TODO: move to props: {dst: {successor}, onSuccessorChange }
  // const [successor, setSuccessor] = React.useState(workflows.bucketToSuccessor(bucket))
  const currentBucketCanBeSuccessor = s3Path !== undefined
  // const addToPackage = AddToPackage.use()

  // const s3 = AWS.S3.use()
  // const workflowsData = Data.use(
  //   requests.workflowsConfig,
  //   { s3, bucket: dst.bucket },
  //   { noAutoFetch: !bucket },
  // )
  // const { prefs } = BucketPreferences.use()

  // const manifestData = useManifest({
  //   bucket,
  //   // this only gets passed when src is defined, so it should be always non-null when the query gets executed
  //   name: src?.name!,
  //   hashOrTag: src?.hash,
  //   pause: !(src && isOpen),
  // })

  // const manifestResult = src ? manifestData.result : EMPTY_MANIFEST_RESULT

  // AsyncResult<Model.PackageContentsFlatMap | undefined>
  // const data = React.useMemo(
  //   () =>
  //     workflowsData.case({
  //       Ok: (workflowsConfig: workflows.WorkflowsConfig) =>
  //         AsyncResult.case(
  //           {
  //             Ok: (manifest: Manifest | undefined) =>
  //               BucketPreferences.Result.match(
  //                 {
  //                   Ok: ({ ui: { sourceBuckets } }) =>
  //                     AsyncResult.Ok({
  //                       manifest,
  //                       workflowsConfig,
  //                       sourceBuckets: prependSourceBucket(sourceBuckets, bucket),
  //                     }),
  //                   Pending: AsyncResult.Pending,
  //                   Init: AsyncResult.Init,
  //                 },
  //                 prefs,
  //               ),

  //             _: R.identity,
  //           },
  //           manifestResult,
  //         ),
  //       _: R.identity,
  //     }),
  //   [bucket, workflowsData, manifestResult, prefs],
  // )

  const [waitingListing, setWaitingListing] = React.useState(false)
  const getFiles = requests.useFilesListing()

  const open = React.useCallback(
    async (initial?: {
      successor?: workflows.Successor
      path?: string
      selection?: Selection.ListingSelection
    }) => {
      if (initial?.successor) {
        setDst((d) => (initial.successor ? { ...d, bucket: initial.successor.slug } : d))
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
      // addToPackage?.merge(filesMap)

      setOpen(filesMap)

      setWaitingListing(false)
    },
    [, /*addToPackage*/ getFiles, setOpen, setDst],
  )

  const close = React.useCallback(() => {
    // if (submitting) return
    setOpen(false)
    // setWorkflow(undefined) // TODO: is this necessary?
    // addToPackage?.clear()
    reset()
  }, [/*addToPackage, */ reset, /*submitting,*/ setOpen])

  const handleExited = React.useCallback(() => {
    setExited(true)
    // setSuccess(false)
  }, [setExited /*, setSuccess*/])

  Intercom.usePauseVisibilityWhen(isOpen)

  const state = React.useMemo<DialogState>(() => {
    if (exited) return DialogState.Closed()

    if (formStatus._tag === 'success') return DialogState.Success(formStatus.handle)
    if (waitingListing) return DialogState.Loading({ waitListing: true })
    if (workflowsConfig._tag === 'loading') return DialogState.Loading()
    if (workflowsConfig._tag === 'error') return DialogState.Error(workflowsConfig.error)
    return DialogState.Form()
    // return AsyncResult.case(
    //   {
    //     Ok: DialogState.Form,
    //     Err: DialogState.Error,
    //     _: DialogState.Loading,
    //   },
    //   data,
    // )
  }, [waitingListing, exited, workflowsConfig, formStatus])

  const render = (ui: PackageCreationDialogUIOptions = {}) => (
    <PD.DialogWrapper
      exited={exited}
      fullWidth
      maxWidth={formStatus._tag === 'success' ? 'sm' : 'lg'}
      onClose={close}
      onExited={handleExited}
      open={!!isOpen}
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
          Form: (/*{ manifest, workflowsConfig, sourceBuckets }*/) => (
            /*
            <PD.SchemaFetcher
              initialWorkflowId={manifest?.workflowId}
              workflowsConfig={workflowsConfig}
              workflow={workflow}
            >
              {(schemaProps) => (
            */
            <PackageCreationForm
              // {...schemaProps}
              {...{
                bucket,
                // successor,
                close,
                // setSubmitting,
                // setSuccess,
                // setWorkflow,
                // workflowsConfig,
                // sourceBuckets,
                // initial: {
                //   name: src?.name,
                //   ...manifest,
                // },
                currentBucketCanBeSuccessor,
                // delayHashing,
                disableStateDisplay,
                // onSuccessor: setSuccessor,
                ui: {
                  title: ui.title,
                  submit: ui.submit,
                  resetFiles: ui.resetFiles,
                },
              }}
            />
            /*
              )}
            </PD.SchemaFetcher>
            */
          ),
          Success: (props) => (
            <DialogSuccess
              {...props}
              bucket={dst.bucket}
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
