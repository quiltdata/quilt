import cx from 'classnames'
import * as R from 'ramda'
import * as React from 'react'
import { useDropzone } from 'react-dropzone'
// import { useHistory, Link } from 'react-router-dom'
import * as M from '@material-ui/core'

import * as APIConnector from 'utils/APIConnector'
import * as AWS from 'utils/AWS'
// import * as Data from 'utils/Data'
import Delay from 'utils/Delay'
import * as NamedRoutes from 'utils/NamedRoutes'
import * as RF from 'utils/ReduxForm'
import pipeThru from 'utils/pipeThru'
import { readableBytes } from 'utils/string'
import * as validators from 'utils/validators'

// import * as requests from './requests'

const getNormalizedPath = (f) => (f.path.startsWith('/') ? f.path.substring(1) : f.path)

function Field({ input, meta, errors, label, ...rest }) {
  const error = meta.submitFailed && meta.error
  const props = {
    error: !!error,
    label: error ? errors[error] || error : label,
    disabled: meta.submitting || meta.submitSucceeded,
    InputLabelProps: { shrink: true },
    ...input,
    ...rest,
  }
  return <M.TextField {...props} />
}

const useFilesInputStyles = M.makeStyles((t) => ({
  root: {
    marginTop: t.spacing(1),
  },
  header: {
    alignItems: 'center',
    display: 'flex',
    height: 24,
  },
  uploading: {
    ...t.typography.body2,
    color: t.palette.text.secondary,
    marginRight: t.spacing(0.5),
  },
  dropzoneContainer: {
    position: 'relative',
  },
  dropzone: {
    background: t.palette.action.hover,
    border: `1px solid ${t.palette.action.disabled}`,
    borderRadius: t.shape.borderRadius,
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    marginTop: t.spacing(1),
    minHeight: 100,
    outline: 'none',
    overflow: 'hidden',
  },
  dropzoneErr: {
    borderColor: t.palette.error.main,
  },
  active: {
    background: t.palette.action.selected,
  },
  lock: {
    background: 'rgba(255,255,255,0.4)',
    bottom: 0,
    cursor: 'not-allowed',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  dropMsg: {
    ...t.typography.body2,
    alignItems: 'center',
    display: 'flex',
    flexGrow: 1,
    justifyContent: 'center',
    paddingBottom: t.spacing(1),
    paddingTop: t.spacing(1),
    textAlign: 'center',
  },
  dropMsgErr: {
    color: t.palette.error.main,
  },
  filesContainer: {
    borderBottom: `1px solid ${t.palette.action.disabled}`,
    maxHeight: 200,
    overflowX: 'hidden',
    overflowY: 'auto',
  },
  fileEntry: {
    alignItems: 'center',
    background: t.palette.background.paper,
    display: 'flex',
    '&:not(:last-child)': {
      borderBottom: `1px solid ${t.palette.action.disabled}`,
    },
  },
  filePath: {
    ...t.typography.body2,
    flexGrow: 1,
    marginRight: t.spacing(1),
    overflow: 'hidden',
    paddingLeft: t.spacing(1),
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  fileSize: {
    ...t.typography.body2,
    color: t.palette.text.secondary,
    marginRight: t.spacing(0.5),
  },
  fileProgress: {
    flexShrink: 0,
    padding: 3,
  },
}))

function FilesInput({ input, meta, uploads = {}, errors = {} }) {
  const classes = useFilesInputStyles()

  const value = input.value || []
  const disabled = meta.submitting || meta.submitSucceeded
  const error = meta.submitFailed && meta.error
  const label = error ? errors[error] || error : 'Drop files here or click to browse'

  const uploadInProgress = !!uploads && !R.isEmpty(uploads)

  const onDrop = React.useCallback(
    disabled
      ? () => {}
      : R.pipe(
          R.reduce((entries, file) => {
            const path = getNormalizedPath(file)
            const idx = entries.findIndex(R.propEq('path', path))
            const put = idx === -1 ? R.append : R.update(idx)
            return put({ path, file }, entries)
          }, value),
          R.sortBy(R.prop('path')),
          input.onChange,
        ),
    [disabled, value, input.onChange],
  )

  const rmFile = ({ path }) => (e) => {
    e.stopPropagation()
    if (disabled) return
    pipeThru(value)(R.reject(R.propEq('path', path)), input.onChange)
  }

  const clearFiles = React.useCallback(() => {
    if (disabled) return
    input.onChange([])
  }, [meta.submitting, input.onChange])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop })

  return (
    <div className={classes.root}>
      <div className={classes.header}>
        <M.Typography color={error ? 'error' : undefined}>
          Files{!!value.length && ` (${value.length})`}
        </M.Typography>
        <M.Box flexGrow={1} />
        {uploadInProgress ? (
          <>
            <div className={classes.uploading}>Uploading files</div>
            <M.CircularProgress
              className={classes.fileProgress}
              size={24}
              value={getTotalProgress(uploads) * 100}
              variant="determinate"
            />
          </>
        ) : (
          !!value.length && (
            <M.Button
              size="small"
              onClick={clearFiles}
              endIcon={<M.Icon fontSize="small">clear</M.Icon>}
            >
              clear files
            </M.Button>
          )
        )}
      </div>

      <div className={classes.dropzoneContainer}>
        <div
          {...getRootProps({
            className: cx(
              classes.dropzone,
              isDragActive && !disabled && classes.active,
              !!error && classes.dropzoneErr,
            ),
          })}
        >
          <input {...getInputProps()} />

          {!!value.length && (
            <div className={classes.filesContainer}>
              {value.map(({ file, path }) => {
                const uploadProgress = getFileProgress(path, uploads)
                return (
                  <div key={path} className={classes.fileEntry}>
                    <div className={classes.filePath} title={path}>
                      {path}
                    </div>
                    <div className={classes.fileSize}>{readableBytes(file.size)}</div>
                    {uploadInProgress ? (
                      <M.CircularProgress
                        className={classes.fileProgress}
                        size={24}
                        value={uploadProgress ? uploadProgress * 100 : undefined}
                        variant={uploadProgress ? 'determinate' : 'indeterminate'}
                      />
                    ) : (
                      <M.IconButton onClick={rmFile({ path })} size="small">
                        <M.Icon fontSize="inherit">clear</M.Icon>
                      </M.IconButton>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          <div className={cx(classes.dropMsg, !!error && classes.dropMsgErr)}>
            {label}
          </div>
        </div>
        {disabled && <div className={classes.lock} />}
      </div>
    </div>
  )
}

const getFileProgress = (path, uploads) => {
  const { loaded, total } = R.path([path, 'progress'], uploads) || {}
  return total ? (loaded || 0) / total : undefined
}

const getTotalProgress = R.pipe(
  R.values,
  R.reduce(
    (acc, { progress: p = {} }) => ({
      total: acc.total + (p.total || 0),
      loaded: acc.loaded + (p.loaded || 0),
    }),
    { total: 0, loaded: 0 },
  ),
  ({ total, loaded }) => loaded / total,
)

const nonEmptyImmutable = (v) => v && validators.nonEmpty(v.toJS ? v.toJS() : v)

export default function UploadDialog({ bucket, open, onClose }) {
  const s3 = AWS.S3.use()
  const req = APIConnector.use()
  const [uploads, setUploads] = React.useState({})

  const handleClose = ({ submitting }) => () => {
    if (submitting) return
    // TODO: ask to abort if in progress
    onClose()
  }

  const updateProgress = React.useCallback(
    (path, loaded) => {
      setUploads(R.assocPath([path, 'progress', 'loaded'], loaded))
    },
    [setUploads],
  )

  const totalProgress = getTotalProgress(uploads)

  const onSubmit = React.useCallback(
    async (values) => {
      const { name, msg, files } = values.toJS()
      console.log('submit', { name, msg, files })
      // TODO: rate-limited queue
      const uploadStates = files.map(({ path, file }) => {
        console.log('uploading file', { path, file })
        const upload = s3.upload(
          {
            Bucket: bucket,
            Key: `${name}/${path}`,
            Body: file,
            // ACL:
            // Metadata:
          },
          {
            // partSize:
            // queueSize:
          },
        )
        upload.on('httpUploadProgress', ({ loaded }) => {
          updateProgress(path, loaded)
        })
        const promise = upload.promise()
        return { path, upload, promise, progress: { total: file.size, loaded: 0 } }
      })

      pipeThru(uploadStates)(
        R.map(({ path, ...rest }) => ({ [path]: rest })),
        R.mergeAll,
        setUploads,
      )

      const uploaded = await Promise.all(uploadStates.map((x) => x.promise))

      const contents = R.zipWith(
        (f, u) => ({
          logical_key: f.path,
          physical_key: `s3://${bucket}/${u.Key}${NamedRoutes.mkSearch({
            versionId: u.VersionId,
          })}`,
        }),
        files,
        uploaded,
      )

      try {
        const res = await req({
          endpoint: '/packages',
          method: 'POST',
          body: {
            name,
            registry: bucket,
            message: msg,
            contents,
          },
        })
        console.log('pkg create api resp', res)
      } catch (e) {
        console.log('pkg create api err', e)
        // TODO
        throw new RF.SubmissionError({ _error: 'unexpected' })
      }
    },
    [bucket, s3, updateProgress, setUploads, req],
  )

  // TODO: success screen on submitSucceeded

  return (
    <RF.ReduxForm
      form="Bucket.PackageUpload"
      onSubmit={onSubmit}
      initialValues={{ files: [] }}
    >
      {({ handleSubmit, submitting, submitFailed, /* error, */ invalid }) => (
        <M.Dialog open={open} onClose={handleClose({ submitting })} fullWidth>
          <M.DialogTitle>New package</M.DialogTitle>
          <M.DialogContent style={{ paddingTop: 0 }}>
            <form onSubmit={handleSubmit}>
              <RF.Field
                component={Field}
                name="name"
                label="Name"
                placeholder="Enter a package name"
                validate={[validators.required]}
                errors={{
                  required: 'Enter a package name',
                }}
                fullWidth
              />

              <RF.Field
                component={Field}
                name="msg"
                label="Commit message"
                placeholder="Enter a commit message"
                validate={[validators.required]}
                errors={{
                  required: 'Enter a commit message',
                }}
                fullWidth
                margin="normal"
              />

              <RF.Field
                component={FilesInput}
                name="files"
                validate={[nonEmptyImmutable]}
                errors={{
                  nonEmpty: 'Add files to create a package',
                }}
                uploads={uploads}
              />

              <input type="submit" style={{ display: 'none' }} />
            </form>
          </M.DialogContent>
          <M.DialogActions>
            {submitting && (
              <Delay ms={200} alwaysRender>
                {(ready) => (
                  <M.Fade in={ready}>
                    <M.Box flexGrow={1} display="flex" alignItems="center" pl={2}>
                      <M.CircularProgress
                        size={24}
                        variant={totalProgress < 1 ? 'determinate' : 'indeterminate'}
                        value={totalProgress < 1 ? totalProgress * 90 : undefined}
                      />
                      <M.Box pl={1} />
                      <M.Typography variant="body2" color="textSecondary">
                        {totalProgress < 1 ? 'Uploading files' : 'Creating a manifest'}
                      </M.Typography>
                    </M.Box>
                  </M.Fade>
                )}
              </Delay>
            )}
            <M.Button
              onClick={handleClose({ submitting })}
              color="primary"
              disabled={submitting}
            >
              Cancel
            </M.Button>
            <M.Button
              onClick={handleSubmit}
              variant="contained"
              color="primary"
              disabled={submitting || (submitFailed && invalid)}
            >
              Push
            </M.Button>
          </M.DialogActions>
        </M.Dialog>
      )}
    </RF.ReduxForm>
  )
}
