import cx from 'classnames'
import { FORM_ERROR } from 'final-form'
import pLimit from 'p-limit'
import * as R from 'ramda'
import * as React from 'react'
import { useDropzone } from 'react-dropzone'
import * as RF from 'react-final-form'
import { Link } from 'react-router-dom'
import * as redux from 'react-redux'
import * as M from '@material-ui/core'

import * as authSelectors from 'containers/Auth/selectors'
import AsyncResult from 'utils/AsyncResult'
import * as AWS from 'utils/AWS'
import { useData } from 'utils/Data'
import * as NamedRoutes from 'utils/NamedRoutes'
import StyledLink from 'utils/StyledLink'
import useDragging from 'utils/dragging'
import pipeThru from 'utils/pipeThru'
import * as s3paths from 'utils/s3paths'
import { readableBytes } from 'utils/string'
import * as validators from 'utils/validators'

import * as PD from './PackageDialog'
import * as requests from './requests'

const useFilesInputStyles = M.makeStyles((t) => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    alignItems: 'center',
    display: 'flex',
    height: 24,
  },
  headerFiles: {
    ...t.typography.body1,
    display: 'flex',
  },
  headerFilesDisabled: {
    color: t.palette.text.secondary,
  },
  headerFilesError: {
    color: t.palette.error.main,
  },
  headerFilesWarn: {
    color: t.palette.warning.dark,
  },
  dropzoneContainer: {
    display: 'flex',
    flexDirection: 'column',
    flexGrow: 1,
    marginTop: t.spacing(2),
    overflowY: 'auto',
    position: 'relative',
  },
  dropzone: {
    border: `1px solid ${t.palette.action.disabled}`,
    borderRadius: t.shape.borderRadius,
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    flexGrow: 1,
    outline: 'none',
    overflow: 'hidden',
  },
  dropzoneErr: {
    borderColor: t.palette.error.main,
  },
  dropzoneWarn: {
    borderColor: t.palette.warning.dark,
  },
  active: {
    background: t.palette.action.selected,
  },
  outlined: {
    outline: `2px dashed ${t.palette.primary.light}`,
    outlineOffset: '-2px',
  },
  dropMsg: {
    ...t.typography.body2,
    alignItems: 'center',
    background: t.palette.action.hover,
    cursor: 'pointer',
    display: 'flex',
    flexGrow: 1,
    justifyContent: 'center',
    paddingBottom: t.spacing(6),
    paddingTop: t.spacing(6),
    textAlign: 'center',
  },
  dropMsgErr: {
    color: t.palette.error.main,
  },
  dropMsgWarn: {
    color: t.palette.warning.dark,
  },
  filesContainer: {
    borderBottom: `1px solid ${t.palette.action.disabled}`,
    overflowX: 'hidden',
    overflowY: 'auto',
  },
  filesContainerErr: {
    borderColor: t.palette.error.main,
  },
  filesContainerWarn: {
    borderColor: t.palette.warning.dark,
  },
  fileEntry: {
    alignItems: 'center',
    display: 'flex',
    '&:not(:last-child)': {
      borderBottomStyle: 'solid',
      borderBottomWidth: '1px',
      borderColor: 'inherit',
    },
  },
  filePath: {
    ...t.typography.body2,
    flexGrow: 1,
    marginRight: t.spacing(1),
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  fileSize: {
    ...t.typography.body2,
    color: t.palette.text.secondary,
    marginRight: t.spacing(0.5),
  },
  lock: {
    alignItems: 'center',
    background: 'rgba(255,255,255,0.9)',
    border: `1px solid ${t.palette.action.disabled}`,
    borderRadius: t.shape.borderRadius,
    bottom: 0,
    cursor: 'not-allowed',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  progressContainer: {
    display: 'flex',
    position: 'relative',
  },
  progressPercent: {
    ...t.typography.h5,
    alignItems: 'center',
    bottom: 0,
    display: 'flex',
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  progressSize: {
    ...t.typography.body2,
    color: t.palette.text.secondary,
    marginTop: t.spacing(1),
  },
}))

function FilesInput({
  input: { value: inputValue, onChange: onInputChange },
  className,
  meta,
  uploads,
  setUploads,
  errors = {},
}) {
  const classes = useFilesInputStyles()

  const value = React.useMemo(() => inputValue || [], [inputValue])
  const disabled = meta.submitting || meta.submitSucceeded
  const error = meta.submitFailed && meta.error

  const totalSize = React.useMemo(() => value.reduce((sum, f) => sum + f.file.size, 0), [
    value,
  ])

  const warn = totalSize > PD.MAX_SIZE

  // eslint-disable-next-line no-nested-ternary
  const label = error ? (
    errors[error] || error
  ) : warn ? (
    <>Total file size exceeds recommended maximum of {readableBytes(PD.MAX_SIZE)}</>
  ) : (
    'Drop files here or click to browse'
  )

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const onDrop = React.useCallback(
    disabled
      ? () => {}
      : R.pipe(
          R.reduce((entries, file) => {
            const path = PD.getNormalizedPath(file)
            const idx = entries.findIndex(R.propEq('path', path))
            const put = idx === -1 ? R.append : R.update(idx)
            return put({ path, file }, entries)
          }, value),
          R.sortBy(R.prop('path')),
          onInputChange,
        ),
    [disabled, value, onInputChange],
  )

  const rmFile = ({ path }) => (e) => {
    e.stopPropagation()
    if (disabled) return
    pipeThru(value)(R.reject(R.propEq('path', path)), onInputChange)
    setUploads(R.dissoc(path))
  }

  const clearFiles = React.useCallback(() => {
    if (disabled) return
    onInputChange([])
    setUploads({})
  }, [disabled, setUploads, onInputChange])

  const isDragging = useDragging()
  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop })

  const totalProgress = React.useMemo(() => getTotalProgress(uploads), [uploads])
  return (
    <div className={cx(classes.root, className)}>
      <div className={classes.header}>
        <div
          className={cx(
            classes.headerFiles,
            disabled // eslint-disable-line no-nested-ternary
              ? classes.headerFilesDisabled
              : error // eslint-disable-line no-nested-ternary
              ? classes.headerFilesError
              : warn
              ? classes.headerFilesWarn
              : undefined,
          )}
        >
          Files
          {!!value.length && (
            <>
              : {value.length} ({readableBytes(totalSize)})
              {warn && <M.Icon style={{ marginLeft: 4 }}>error_outline</M.Icon>}
            </>
          )}
        </div>
        <M.Box flexGrow={1} />
        {!!value.length && (
          <M.Button
            onClick={clearFiles}
            disabled={disabled}
            size="small"
            endIcon={<M.Icon fontSize="small">clear</M.Icon>}
          >
            clear files
          </M.Button>
        )}
      </div>

      <div className={classes.dropzoneContainer}>
        <div
          {...getRootProps({
            className: cx(
              classes.dropzone,
              isDragActive && !disabled && classes.active,
              !!error && classes.dropzoneErr,
              !error && warn && classes.dropzoneWarn,
              isDragging && classes.outlined,
            ),
          })}
        >
          <input {...getInputProps()} />

          {!!value.length && (
            <div
              className={cx(
                classes.filesContainer,
                !!error && classes.filesContainerErr,
                !error && warn && classes.filesContainerWarn,
              )}
            >
              {value.map(({ file, path }) => (
                <div key={path} className={classes.fileEntry}>
                  <M.IconButton onClick={rmFile({ path })} size="small">
                    <M.Icon fontSize="inherit">clear</M.Icon>
                  </M.IconButton>
                  <div className={classes.filePath} title={path}>
                    {path}
                  </div>
                  <div className={classes.fileSize}>{readableBytes(file.size)}</div>
                </div>
              ))}
            </div>
          )}

          <div
            className={cx(
              classes.dropMsg,
              !!error && classes.dropMsgErr,
              !error && warn && classes.dropMsgWarn,
            )}
          >
            <span>{label}</span>
          </div>
        </div>
        {disabled && (
          <div className={classes.lock}>
            <div className={classes.progressContainer}>
              <M.CircularProgress
                size={80}
                value={totalProgress.percent}
                variant="determinate"
              />
              <div className={classes.progressPercent}>{totalProgress.percent}%</div>
            </div>
            <div className={classes.progressSize}>
              {readableBytes(totalProgress.loaded)} / {readableBytes(totalProgress.total)}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const useDialogSuccessStyles = M.makeStyles({
  content: {
    paddingTop: 0,
  },
})

function DialogSuccess({ bucket, hash, name, onClose }) {
  const { urls } = NamedRoutes.use()

  const classes = useDialogSuccessStyles()

  return (
    <>
      <M.DialogTitle>Package created</M.DialogTitle>
      <M.DialogContent className={classes.content}>
        <M.Typography>
          Package{' '}
          <StyledLink to={urls.bucketPackageTree(bucket, name, hash)}>
            {name}@{R.take(10, hash)}
          </StyledLink>{' '}
          successfully created
        </M.Typography>
      </M.DialogContent>
      <M.DialogActions>
        <M.Button onClick={onClose}>Close</M.Button>
        <M.Button
          component={Link}
          to={urls.bucketPackageTree(bucket, name, hash)}
          variant="contained"
          color="primary"
        >
          Browse package
        </M.Button>
      </M.DialogActions>
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
    marginTop: t.spacing(3),
    overflowY: 'auto',
  },
}))

const getTotalProgress = R.pipe(
  R.values,
  R.reduce(
    (acc, { progress: p = {} }) => ({
      total: acc.total + (p.total || 0),
      loaded: acc.loaded + (p.loaded || 0),
    }),
    { total: 0, loaded: 0 },
  ),
  (p) => ({
    ...p,
    percent: p.total ? Math.floor((p.loaded / p.total) * 100) : undefined,
  }),
)

function PackageCreateDialog({
  bucket,
  close,
  refresh,
  responseError,
  schema,
  schemaLoading,
  selectedWorkflow,
  setSubmitting,
  setSuccess,
  setWorkflow,
  validate: validateMetaInput,
  workflowsConfig,
}) {
  const s3 = AWS.S3.use()
  const [uploads, setUploads] = React.useState({})
  const nameValidator = PD.useNameValidator()
  const nameExistence = PD.useNameExistence(bucket)
  const [nameWarning, setNameWarning] = React.useState('')
  const [metaHeight, setMetaHeight] = React.useState(0)
  const classes = useStyles()
  const dialogContentClasses = PD.useContentStyles({ metaHeight })

  const totalProgress = getTotalProgress(uploads)
  const createPackage = requests.useCreatePackage()

  // eslint-disable-next-line consistent-return
  const onSubmit = async ({ name, msg, files, meta, workflow }) => {
    const limit = pLimit(2)
    let rejected = false
    const uploadStates = files.map(({ path, file }) => {
      // reuse state if file hasnt changed
      const entry = uploads[path]
      if (entry && entry.file === file) return { ...entry, path }

      const upload = s3.upload(
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
      return { [FORM_ERROR]: PD.ERROR_MESSAGES.UPLOAD }
    }

    const contents = R.zipWith(
      (f, u) => ({
        logical_key: f.path,
        physical_key: s3paths.handleToS3Url({
          bucket,
          key: u.result.Key,
          version: u.result.VersionId,
        }),
        size: f.file.size,
        hash: u.hash,
      }),
      files,
      uploaded,
    )

    try {
      const res = await createPackage(
        {
          contents,
          message: msg,
          meta,
          target: {
            bucket,
            name,
          },
          workflow,
        },
        schema,
      )
      if (refresh) {
        // wait for ES index to receive the new package data
        await new Promise((resolve) => setTimeout(resolve, PD.ES_LAG))
        refresh()
      }
      setSuccess({ name, hash: res.top_hash })
    } catch (e) {
      // eslint-disable-next-line no-console
      console.log('error creating manifest', e)
      // TODO: handle specific cases?
      return { [FORM_ERROR]: e.message || PD.ERROR_MESSAGES.MANIFEST }
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

  const onSubmitWrapped = async (...args) => {
    setSubmitting(true)
    try {
      return await onSubmit(...args)
    } finally {
      setSubmitting(false)
    }
  }

  const [editorElement, setEditorElement] = React.useState()

  const resizeObserver = React.useMemo(
    () =>
      new window.ResizeObserver((entries) => {
        const { height } = entries[0]?.contentRect
        setMetaHeight(height)
      }),
    [setMetaHeight],
  )

  const onFormChange = React.useCallback(
    ({ dirtyFields, values }) => {
      if (dirtyFields.name) handleNameChange(values.name)
    },
    [handleNameChange],
  )

  React.useEffect(() => {
    if (editorElement) resizeObserver.observe(editorElement)
    return () => {
      if (editorElement) resizeObserver.unobserve(editorElement)
    }
  }, [editorElement, resizeObserver])

  const username = redux.useSelector(authSelectors.username)
  const usernamePrefix = React.useMemo(() => PD.getUsernamePrefix(username), [username])

  return (
    <RF.Form
      onSubmit={onSubmitWrapped}
      subscription={{
        handleSubmit: true,
        submitting: true,
        submitFailed: true,
        error: true,
        submitError: true,
        hasValidationErrors: true,
        form: true,
      }}
      validate={PD.useCryptoApiValidation()}
    >
      {({
        error,
        form,
        handleSubmit,
        hasValidationErrors,
        submitError,
        submitFailed,
        submitting,
      }) => (
        <>
          <M.DialogTitle>Create package</M.DialogTitle>
          <M.DialogContent classes={dialogContentClasses}>
            <form className={classes.form} onSubmit={handleSubmit}>
              <RF.FormSpy
                subscription={{ dirtyFields: true, submitting: true, values: true }}
                onChange={onFormChange}
              />

              <RF.FormSpy
                subscription={{ modified: true, values: true }}
                onChange={({ modified, values }) => {
                  if (modified.workflow && values.workflow !== selectedWorkflow) {
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
                    validate={validators.required}
                    validateFields={['meta', 'workflow']}
                    errors={{
                      required: 'Workflow is required for this bucket.',
                    }}
                  />

                  <RF.Field
                    component={PD.PackageNameInput}
                    initialValue={usernamePrefix}
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
                    validate={validators.required}
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
                      initialValue={PD.EMPTY_META_VALUE}
                      ref={setEditorElement}
                    />
                  )}
                </PD.LeftColumn>

                <PD.RightColumn>
                  <RF.Field
                    className={classes.files}
                    component={FilesInput}
                    name="files"
                    validate={validators.nonEmpty}
                    validateFields={['files']}
                    errors={{
                      nonEmpty: 'Add files to create a package',
                    }}
                    uploads={uploads}
                    setUploads={setUploads}
                    isEqual={R.equals}
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
              Create
            </M.Button>
          </M.DialogActions>
        </>
      )}
    </RF.Form>
  )
}

export default function PackageCreateDialogWrapper({ bucket, open, onClose, refresh }) {
  const s3 = AWS.S3.use()
  const data = useData(requests.workflowsConfig, { s3, bucket }, { noAutoFetch: !open })

  const [workflow, setWorkflow] = React.useState(null)
  const [success, setSuccess] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)

  const close = React.useCallback(() => {
    if (submitting && !success) return

    setWorkflow(null)
    onClose()
  }, [submitting, success, onClose])

  return (
    <M.Dialog
      fullWidth
      maxWidth={success ? 'sm' : 'lg'}
      onClose={close}
      onExited={close}
      open={open}
      scroll="body"
    >
      {data.case({
        Ok: (workflowsConfig) =>
          success ? (
            <DialogSuccess
              bucket={bucket}
              hash={success.hash}
              name={success.name}
              onClose={close}
            />
          ) : (
            <PD.SchemaFetcher workflow={workflow} workflowsConfig={workflowsConfig}>
              {AsyncResult.case({
                Ok: (schemaProps) => (
                  <PackageCreateDialog
                    {...schemaProps}
                    {...{
                      bucket,
                      close,
                      setSubmitting,
                      setSuccess,
                      setWorkflow,
                      workflowsConfig,

                      refresh,
                    }}
                  />
                ),
                _: R.identity,
              })}
            </PD.SchemaFetcher>
          ),
        Err: (error) => (
          <PD.DialogError
            error={error}
            skeletonElement={<PD.FormSkeleton animate={false} />}
            title="Create package"
            onCancel={close}
          />
        ),
        _: () => (
          <PD.DialogLoading
            skeletonElement={<PD.FormSkeleton />}
            title="Create package"
            onCancel={close}
          />
        ),
      })}
    </M.Dialog>
  )
}
