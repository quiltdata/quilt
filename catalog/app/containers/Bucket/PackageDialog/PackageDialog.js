import * as R from 'ramda'
import * as React from 'react'
import { useDropzone } from 'react-dropzone'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import JsonEditor from 'components/JsonEditor'
import { parseJSON, stringifyJSON } from 'components/JsonEditor/State'
import * as Notifications from 'containers/Notifications'
import { useData } from 'utils/Data'
import Delay from 'utils/Delay'
import AsyncResult from 'utils/AsyncResult'
import * as APIConnector from 'utils/APIConnector'
import * as AWS from 'utils/AWS'
import { makeSchemaValidator } from 'utils/json-schema'
import pipeThru from 'utils/pipeThru'
import { readableBytes } from 'utils/string'
import * as validators from 'utils/validators'
import * as workflows from 'utils/workflows'

import * as requests from '../requests'
import SelectWorkflow from './SelectWorkflow'

export const MAX_SIZE = 1000 * 1000 * 1000 // 1GB
export const ES_LAG = 3 * 1000
export const MAX_META_FILE_SIZE = 10 * 1000 * 1000 // 10MB

export const ERROR_MESSAGES = {
  UPLOAD: 'Error uploading files',
  MANIFEST: 'Error creating manifest',
}

export const getNormalizedPath = R.pipe(
  R.prop('path'),
  R.when(R.startsWith('/'), R.drop(1)),
)

export async function hashFile(file) {
  if (!window.crypto || !window.crypto.subtle || !window.crypto.subtle.digest) return
  try {
    const buf = await file.arrayBuffer()
    const hashBuf = await window.crypto.subtle.digest('SHA-256', buf)
    // eslint-disable-next-line consistent-return
    return Array.from(new Uint8Array(hashBuf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  } catch (e) {
    // return undefined on error
  }
}

function cacheDebounce(fn, wait, getKey = R.identity) {
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

const readFile = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onabort = () => {
      reject(new Error('abort'))
    }
    reader.onerror = () => {
      reject(reader.error)
    }
    reader.onload = () => {
      resolve(reader.result)
    }
    reader.readAsText(file)
  })

const validateName = (req) =>
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
  }, 200)

export function useNameValidator() {
  const req = APIConnector.use()
  const [counter, setCounter] = React.useState(0)
  const [processing, setProcessing] = React.useState(false)
  const inc = React.useCallback(() => setCounter(R.inc), [setCounter])

  const validator = React.useMemo(() => validateName(req), [req])

  const validate = React.useCallback(
    async (name) => {
      setProcessing(true)
      const error = await validator(name)
      setProcessing(false)
      return error
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [counter, validator],
  )

  return React.useMemo(() => ({ validate, processing, inc }), [validate, processing, inc])
}

export function useNameExistence(bucket) {
  const [counter, setCounter] = React.useState(0)
  const inc = React.useCallback(() => setCounter(R.inc), [setCounter])

  const s3 = AWS.S3.use()

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const validate = React.useCallback(
    cacheDebounce(async (name) => {
      if (name) {
        const packageExists = await requests.ensurePackageIsPresent({
          s3,
          bucket,
          name,
        })
        if (packageExists) return 'exists'
      }
      return undefined
    }, 200),
    [bucket, counter, s3],
  )

  return React.useMemo(() => ({ validate, inc }), [validate, inc])
}

function mkMetaValidator(schema) {
  // TODO: move schema validation to utils/validators
  //       but don't forget that validation depends on library.
  //       Maybe we should split validators to files at first
  const schemaValidator = makeSchemaValidator(schema)
  return function validateMeta(value) {
    const noError = undefined

    const jsonObjectErr = validators.jsonObject(value.text)
    if (jsonObjectErr) {
      return value.mode === 'json'
        ? jsonObjectErr
        : [{ message: 'Metadata must be a valid JSON object' }]
    }

    if (schema) {
      const obj = value ? parseJSON(value.text) : {}
      const errors = schemaValidator(obj)
      if (!errors.length) return noError
      return value.mode === 'json' ? 'schema' : errors
    }

    return noError
  }
}

export const getMetaValue = (value) =>
  value
    ? pipeThru(value.text || '{}')(
        (t) => JSON.parse(t),
        R.toPairs,
        R.filter(([k]) => !!k.trim()),
        R.fromPairs,
        R.when(R.isEmpty, () => undefined),
      )
    : undefined

export function Field({ error, helperText, validating, warning, ...rest }) {
  const props = {
    InputLabelProps: { shrink: true },
    InputProps: {
      endAdornment: validating && <M.CircularProgress size={20} />,
    },
    error: !!error,
    helperText: error || helperText,
    ...rest,
  }
  return <M.TextField {...props} />
}

export function PackageNameInput({ errors, input, meta, validating, ...rest }) {
  const errorCode = (input.value || meta.submitFailed) && meta.error
  const error = errorCode ? errors[errorCode] || errorCode : ''
  const props = {
    disabled: meta.submitting || meta.submitSucceeded,
    error,
    fullWidth: true,
    label: 'Name',
    margin: 'normal',
    placeholder: 'e.g. user/package',
    // NOTE: react-form doesn't change `FormState.validating` on async validation when field loses focus
    validating,
    ...input,
    ...rest,
  }
  return <Field {...props} />
}

export function CommitMessageInput({ errors, input, meta, ...rest }) {
  const errorCode = meta.submitFailed && meta.error
  const error = errorCode ? errors[errorCode] || errorCode : ''
  const props = {
    disabled: meta.submitting || meta.submitSucceeded,
    error,
    fullWidth: true,
    label: 'Commit message',
    margin: 'normal',
    placeholder: 'Enter a commit message',
    validating: meta.submitFailed && meta.validating,
    ...input,
    ...rest,
  }
  return <Field {...props} />
}

const useWorkflowInputStyles = M.makeStyles((t) => ({
  root: {
    margin: t.spacing(3, 0),
  },
}))

export function WorkflowInput({ input, meta, workflowsConfig, errors = {} }) {
  const classes = useWorkflowInputStyles()

  const disabled = meta.submitting || meta.submitSucceeded
  const errorKey = meta.submitFailed && meta.error

  return (
    <SelectWorkflow
      className={classes.root}
      items={workflowsConfig ? workflowsConfig.workflows : []}
      onChange={input.onChange}
      value={input.value}
      disabled={disabled}
      error={errorKey ? errors[errorKey] || errorKey : undefined}
    />
  )
}

export const defaultWorkflowFromConfig = (cfg) =>
  cfg ? cfg.workflows.find((item) => item.isDefault) : null

export const getWorkflowApiParam = R.cond([
  [R.equals(workflows.notAvaliable), R.always(undefined)],
  [R.equals(workflows.notSelected), R.always(null)],
  [R.T, R.identity],
])

const useMetaInputStyles = M.makeStyles((t) => ({
  header: {
    alignItems: 'center',
    display: 'flex',
    marginBottom: t.spacing(2),
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
  dropzone: {
    position: 'relative',
  },
  overlay: {
    background: 'rgba(255,255,255,0.6)',
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 1,
  },
  overlayContents: {
    alignItems: 'center',
    display: 'flex',
    height: '100%',
    justifyContent: 'center',
    maxHeight: 120,
  },
  overlayText: {
    ...t.typography.body1,
    color: t.palette.text.secondary,
  },
  overlayProgress: {
    marginRight: t.spacing(1),
  },
}))

export const EMPTY_META_VALUE = { mode: 'kv', text: '{}' }

// TODO: warn on duplicate keys
export function MetaInput({
  className,
  schemaError,
  input: { value, onChange },
  meta,
  schema,
}) {
  const classes = useMetaInputStyles()
  const error = schemaError ? [schemaError] : meta.submitFailed && meta.error
  const disabled = meta.submitting || meta.submitSucceeded

  const parsedValue = React.useMemo(() => {
    const obj = parseJSON(value.text)
    return R.is(Object, obj) && !Array.isArray(obj) ? obj : {}
  }, [value.text])

  const changeMode = (mode) => {
    if (disabled) return
    onChange({ ...value, mode })
  }

  const changeText = React.useCallback(
    (text) => {
      if (disabled) return
      onChange({ ...value, text })
    },
    [disabled, onChange, value],
  )

  const handleModeChange = (e, m) => {
    if (!m) return
    changeMode(m)
  }

  const handleTextChange = (e) => {
    changeText(e.target.value)
  }

  const onJsonEditor = React.useCallback((json) => changeText(stringifyJSON(json)), [
    changeText,
  ])

  const { push: notify } = Notifications.use()
  const [locked, setLocked] = React.useState(false)
  // used to force json editor re-initialization
  const [jsonEditorKey, setJsonEditorKey] = React.useState(1)

  const onDrop = React.useCallback(
    ([file]) => {
      if (file.size > MAX_META_FILE_SIZE) {
        notify(
          <>
            File too large ({readableBytes(file.size)}), must be under{' '}
            {readableBytes(MAX_META_FILE_SIZE)}.
          </>,
        )
        return
      }
      setLocked(true)
      readFile(file)
        .then((contents) => {
          try {
            JSON.parse(contents)
          } catch (e) {
            notify('The file does not contain valid JSON')
          }
          changeText(contents)
          // force json editor to re-initialize
          setJsonEditorKey(R.inc)
        })
        .catch((e) => {
          if (e.message === 'abort') return
          // eslint-disable-next-line no-console
          console.log('Error reading file')
          // eslint-disable-next-line no-console
          console.error(e)
          notify("Couldn't read that file")
        })
        .finally(() => {
          setLocked(false)
        })
    },
    [setLocked, changeText, setJsonEditorKey, notify],
  )

  const { getRootProps, isDragActive } = useDropzone({ onDrop })

  return (
    <div className={className}>
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

      <div {...getRootProps({ className: classes.dropzone })} tabIndex={undefined}>
        {value.mode === 'kv' ? (
          <JsonEditor
            error={error}
            disabled={disabled}
            value={parsedValue}
            onChange={onJsonEditor}
            schema={schema}
            key={jsonEditorKey}
          />
        ) : (
          <M.TextField
            variant="outlined"
            size="small"
            value={value.text}
            onChange={handleTextChange}
            placeholder="Enter JSON metadata if necessary"
            error={!!error}
            helperText={
              !!error &&
              {
                jsonObject: 'Metadata must be a valid JSON object',
                schema: 'Metadata must conform to the schema',
              }[error]
            }
            fullWidth
            multiline
            rowsMax={10}
            InputProps={{ classes: { input: classes.jsonInput } }}
            disabled={disabled}
          />
        )}

        {(isDragActive || locked) && (
          <div className={classes.overlay}>
            {isDragActive ? (
              <div className={classes.overlayContents}>
                <div className={classes.overlayText}>
                  Drop file containing JSON metadata
                </div>
              </div>
            ) : (
              <Delay ms={500} alwaysRender>
                {(ready) => (
                  <M.Fade in={ready}>
                    <div className={classes.overlayContents}>
                      <M.CircularProgress size={20} className={classes.overlayProgress} />
                      <div className={classes.overlayText}>Reading file contents</div>
                    </div>
                  </M.Fade>
                )}
              </Delay>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export function SchemaFetcher({ children, schemaUrl }) {
  const s3 = AWS.S3.use()
  const data = useData(requests.metadataSchema, { s3, schemaUrl })
  const res = React.useMemo(
    () =>
      data.case({
        Ok: (schema) => AsyncResult.Ok({ schema, validate: mkMetaValidator(schema) }),
        Err: (responseError) =>
          AsyncResult.Ok({ responseError, validate: mkMetaValidator(null) }),
        _: R.identity,
      }),
    [data],
  )
  return children(res)
}
