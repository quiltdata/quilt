import cx from 'classnames'
import { FORM_ERROR } from 'final-form'
import pLimit from 'p-limit'
import * as R from 'ramda'
import * as React from 'react'
import { useDropzone } from 'react-dropzone'
import * as RF from 'react-final-form'
import { Link } from 'react-router-dom'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import * as APIConnector from 'utils/APIConnector'
import * as AWS from 'utils/AWS'
import Delay from 'utils/Delay'
import * as NamedRoutes from 'utils/NamedRoutes'
import StyledLink from 'utils/StyledLink'
import pipeThru from 'utils/pipeThru'
import * as s3paths from 'utils/s3paths'
import { readableBytes } from 'utils/string'
import * as validators from 'utils/validators'

const getNormalizedPath = (f) => (f.path.startsWith('/') ? f.path.substring(1) : f.path)

function Field({ input, meta, errors, label, ...rest }) {
  const error = meta.submitFailed && meta.error
  const validating = meta.submitFailed && meta.validating
  const props = {
    error: !!error,
    label: (
      <>
        {error ? errors[error] || error : label}
        {validating && <M.CircularProgress size={13} style={{ marginLeft: 8 }} />}
      </>
    ),
    disabled: meta.submitting || meta.submitSucceeded,
    InputLabelProps: { shrink: true },
    ...input,
    ...rest,
  }
  return <M.TextField {...props} />
}

const useFilesInputStyles = M.makeStyles((t) => ({
  root: {
    marginTop: t.spacing(2),
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
        {/* eslint-disable-next-line no-nested-ternary */}
        <M.Typography color={disabled ? 'textSecondary' : error ? 'error' : undefined}>
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

const tryParse = (v) => {
  try {
    return JSON.parse(v)
  } catch (e) {
    return v
  }
}

const isParsable = (v) => {
  try {
    JSON.parse(v)
    return true
  } catch (e) {
    return false
  }
}

const tryUnparse = (v) =>
  typeof v === 'string' && !isParsable(v) ? v : JSON.stringify(v)

const fieldsToText = R.pipe(
  R.filter((f) => !!f.key.trim()),
  R.map((f) => [f.key, tryParse(f.value)]),
  R.fromPairs,
  (x) => JSON.stringify(x, null, 2),
)

const textToFields = R.pipe(
  (t) => JSON.parse(t),
  Object.entries,
  R.map(([key, value]) => ({ key, value: tryUnparse(value) })),
)

function getMetaValue(value) {
  if (!value) return undefined

  const pairs =
    value.mode === 'json'
      ? pipeThru(value.text || '{}')((t) => JSON.parse(t), R.toPairs)
      : (value.fields || []).map((f) => [f.key, tryParse(f.value)])

  return pipeThru(pairs)(
    R.filter(([k]) => !!k.trim()),
    R.fromPairs,
    R.when(R.isEmpty, () => undefined),
  )
}

function validateMeta(value) {
  if (!value) return
  if (value.mode === 'json') {
    // eslint-disable-next-line consistent-return
    return validators.jsonObject(value.text)
  }
}

const useMetaInputStyles = M.makeStyles((t) => ({
  root: {
    marginTop: t.spacing(3),
  },
  header: {
    alignItems: 'center',
    display: 'flex',
    height: 24,
  },
  btn: {
    fontSize: 11,
    height: 24,
    paddingBottom: 0,
    paddingLeft: 7,
    paddingRight: 7,
    paddingTop: 0,
  },
  json: {
    marginTop: t.spacing(1),
  },
  jsonInput: {
    fontFamily: t.typography.monospace.fontFamily,
    '&::placeholder': {
      fontFamily: t.typography.fontFamily,
    },
  },
  add: {
    marginTop: t.spacing(2),
  },
  row: {
    alignItems: 'center',
    display: 'flex',
    marginTop: t.spacing(1),
  },
  sep: {
    ...t.typography.body1,
    marginLeft: t.spacing(1),
    marginRight: t.spacing(1),
  },
  key: {
    flexBasis: 100,
    flexGrow: 1,
  },
  value: {
    flexBasis: 100,
    flexGrow: 2,
  },
}))

const EMPTY_FIELD = { key: '', value: '' }

// TODO: warn on duplicate keys
function MetaInput({ input, meta }) {
  const classes = useMetaInputStyles()
  const value = input.value || { fields: [EMPTY_FIELD], text: '{}', mode: 'kv' }
  const error = meta.submitFailed && meta.error
  const disabled = meta.submitting || meta.submitSucceeded

  const changeMode = (mode) => {
    if (disabled) return
    input.onChange({ ...value, mode })
  }

  const changeFields = (newFields) => {
    if (disabled) return
    const fields = typeof newFields === 'function' ? newFields(value.fields) : newFields
    const text = fieldsToText(fields)
    input.onChange({ ...value, fields, text })
  }

  const changeText = (text) => {
    if (disabled) return
    let fields
    try {
      fields = textToFields(text)
    } catch (e) {
      fields = value.fields
    }
    input.onChange({ ...value, fields, text })
  }

  const handleModeChange = (e, m) => {
    if (!m) return
    changeMode(m)
  }

  const handleKeyChange = (i) => (e) => {
    changeFields(R.assocPath([i, 'key'], e.target.value))
  }

  const handleValueChange = (i) => (e) => {
    changeFields(R.assocPath([i, 'value'], e.target.value))
  }

  const addField = () => {
    changeFields(R.append(EMPTY_FIELD))
  }

  const rmField = (i) => () => {
    changeFields(R.pipe(R.remove(i, 1), R.when(R.isEmpty, R.append(EMPTY_FIELD))))
  }

  const handleTextChange = (e) => {
    changeText(e.target.value)
  }

  return (
    <div className={classes.root}>
      <div className={classes.header}>
        {/* eslint-disable-next-line no-nested-ternary */}
        <M.Typography color={disabled ? 'textSecondary' : error ? 'error' : undefined}>
          Metadata
        </M.Typography>
        <M.Box flexGrow={1} />
        <Lab.ToggleButtonGroup value={value.mode} exclusive onChange={handleModeChange}>
          <Lab.ToggleButton value="kv" className={classes.btn} disabled={disabled}>
            Key : Value
          </Lab.ToggleButton>
          <Lab.ToggleButton value="json" className={classes.btn} disabled={disabled}>
            JSON
          </Lab.ToggleButton>
        </Lab.ToggleButtonGroup>
      </div>
      {value.mode === 'kv' ? (
        <>
          {value.fields.map((f, i) => (
            // eslint-disable-next-line react/no-array-index-key
            <div key={i} className={classes.row}>
              <M.TextField
                className={classes.key}
                onChange={handleKeyChange(i)}
                value={f.key}
                placeholder="Key"
                disabled={disabled}
              />
              <div className={classes.sep}>:</div>
              <M.TextField
                className={classes.value}
                onChange={handleValueChange(i)}
                value={f.value}
                placeholder="Value"
                disabled={disabled}
              />
              <M.IconButton
                size="small"
                onClick={rmField(i)}
                edge="end"
                disabled={disabled}
              >
                <M.Icon>close</M.Icon>
              </M.IconButton>
            </div>
          ))}
          <M.Button
            variant="outlined"
            size="small"
            onClick={addField}
            startIcon={<M.Icon>add</M.Icon>}
            className={classes.add}
            disabled={disabled}
          >
            Add field
          </M.Button>
        </>
      ) : (
        <M.TextField
          variant="outlined"
          size="small"
          className={classes.json}
          value={value.text}
          onChange={handleTextChange}
          placeholder="Enter JSON metadata if necessary"
          error={!!error}
          helperText={
            !!error &&
            {
              jsonObject: 'Metadata must be a valid JSON object',
            }[error]
          }
          fullWidth
          multiline
          rowsMax={10}
          InputProps={{ classes: { input: classes.jsonInput } }}
          disabled={disabled}
        />
      )}
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

const cacheDebounce = (fn, wait, getKey = R.identity) => {
  const cache = {}
  let timer
  let resolveList = []

  return (...args) => {
    const key = getKey(...args)
    if (key in cache) return cache[key]

    return new Promise((resolveNew) => {
      clearTimeout(timer)

      timer = setTimeout(() => {
        timer = null

        const result = Promise.resolve(fn(...args))
        cache[key] = result

        resolveList.forEach((resolve) => resolve(result))

        resolveList = []
      }, wait)

      resolveList.push(resolveNew)
    })
  }
}

const useCounter = () => {
  const [value, setValue] = React.useState(0)
  const inc = React.useCallback(() => setValue(R.inc), [setValue])
  return React.useMemo(() => ({ value, inc }), [value, inc])
}

export default function UploadDialog({ bucket, open, onClose }) {
  const s3 = AWS.S3.use()
  const req = APIConnector.use()
  const { urls } = NamedRoutes.use()
  const [uploads, setUploads] = React.useState({})
  const [success, setSuccess] = React.useState(null)
  const validateCacheKey = useCounter()

  const validateName = React.useCallback(
    cacheDebounce(async (name) => {
      if (name) {
        const res = await req({
          endpoint: '/package_name_valid',
          method: 'POST',
          body: { name },
        })
        if (!res.valid) return 'invalid'
      }
      return undefined
    }, 200),
    [req, validateCacheKey.value],
  )

  const reset = (form) => () => {
    form.restart()
    setSuccess(null)
    setUploads({})
    validateCacheKey.inc()
  }

  const handleClose = ({ submitting = false } = {}) => () => {
    if (submitting) return
    // TODO: ask to abort if in progress
    onClose()
  }

  const updateUpload = (path, fn) => {
    setUploads(R.evolve({ [path]: fn }))
  }

  const updateProgress = (path, loaded) => {
    updateUpload(path, R.assocPath(['progress', 'loaded'], loaded))
  }

  const totalProgress = getTotalProgress(uploads)

  // eslint-disable-next-line consistent-return
  const onSubmit = async ({ name, msg, files, meta }) => {
    const limit = pLimit(2)
    let rejected = false
    const uploadStates = files.map(({ path, file }) => {
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
        updateProgress(path, loaded)
      })
      const promise = limit(async () => {
        if (rejected) return
        try {
          // eslint-disable-next-line consistent-return
          return await upload.promise()
        } catch (e) {
          // TODO: reset upload state on error?
          rejected = true
          throw e
        }
      })
      return { path, upload, promise, progress: { total: file.size, loaded: 0 } }
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
      // TODO: reset upload state on error?
      return { [FORM_ERROR]: 'Error uploading files' }
    }

    const contents = R.zipWith(
      (f, u) => ({
        logical_key: f.path,
        physical_key: s3paths.handleToS3Url({
          bucket,
          key: u.Key,
          version: u.VersionId,
        }),
        size: f.file.size,
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
          registry: `s3://${bucket}`,
          message: msg,
          contents,
          meta: getMetaValue(meta),
        },
      })
      setSuccess({ name, revision: res.timestamp })
    } catch (e) {
      console.log('error creating manifest', e)
      // TODO: handle specific cases?
      return { [FORM_ERROR]: 'Error creating manifest' }
    }
  }

  return (
    <RF.Form onSubmit={onSubmit}>
      {({
        handleSubmit,
        submitting,
        submitFailed,
        error,
        submitError,
        hasValidationErrors,
        form,
      }) => (
        <M.Dialog
          open={open}
          onClose={handleClose({ submitting })}
          fullWidth
          scroll="body"
          onExited={reset(form)}
        >
          <M.DialogTitle>{success ? 'Push complete' : 'Push package'}</M.DialogTitle>
          {success ? (
            <>
              <M.DialogContent style={{ paddingTop: 0 }}>
                <M.Typography>
                  Package{' '}
                  <StyledLink
                    to={urls.bucketPackageTree(bucket, success.name, success.revision)}
                  >
                    {success.name}@{success.revision}
                  </StyledLink>{' '}
                  successfully created
                </M.Typography>
              </M.DialogContent>
              <M.DialogActions>
                <M.Button onClick={handleClose()}>Close</M.Button>
                <M.Button onClick={reset(form)}>New push</M.Button>
                <M.Button
                  component={Link}
                  to={urls.bucketPackageTree(bucket, success.name, success.revision)}
                  variant="contained"
                  color="primary"
                >
                  Browse
                </M.Button>
              </M.DialogActions>
            </>
          ) : (
            <>
              <M.DialogContent style={{ paddingTop: 0 }}>
                <form onSubmit={handleSubmit}>
                  <RF.Field
                    component={Field}
                    name="name"
                    label="Name"
                    placeholder="Enter a package name"
                    validate={validators.composeAsync(validators.required, validateName)}
                    errors={{
                      required: 'Enter a package name',
                      invalid: 'Invalid package name',
                    }}
                    fullWidth
                  />

                  <RF.Field
                    component={Field}
                    name="msg"
                    label="Commit message"
                    placeholder="Enter a commit message"
                    validate={validators.required}
                    errors={{
                      required: 'Enter a commit message',
                    }}
                    fullWidth
                    margin="normal"
                  />

                  <RF.Field
                    component={FilesInput}
                    name="files"
                    validate={validators.nonEmpty}
                    errors={{
                      nonEmpty: 'Add files to create a package',
                    }}
                    uploads={uploads}
                    isEqual={R.equals}
                  />

                  <RF.Field
                    component={MetaInput}
                    name="meta"
                    validate={validateMeta}
                    isEqual={R.equals}
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
                            {totalProgress < 1
                              ? 'Uploading files'
                              : 'Creating a manifest'}
                          </M.Typography>
                        </M.Box>
                      </M.Fade>
                    )}
                  </Delay>
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

                <M.Button onClick={handleClose({ submitting })} disabled={submitting}>
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
        </M.Dialog>
      )}
    </RF.Form>
  )
}
