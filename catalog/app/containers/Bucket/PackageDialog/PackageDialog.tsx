import cx from 'classnames'
import { FORM_ERROR } from 'final-form'
import mime from 'mime-types'
import * as R from 'ramda'
import * as React from 'react'
import { useDropzone } from 'react-dropzone'
import type * as RF from 'react-final-form'
import * as M from '@material-ui/core'
import { fade } from '@material-ui/core/styles'
import * as Lab from '@material-ui/lab'

import JsonEditor from 'components/JsonEditor'
import { parseJSON, stringifyJSON } from 'components/JsonEditor/utils'
import * as Notifications from 'containers/Notifications'
import { useData } from 'utils/Data'
import Delay from 'utils/Delay'
import * as APIConnector from 'utils/APIConnector'
import * as AWS from 'utils/AWS'
import * as Sentry from 'utils/Sentry'
import useDragging from 'utils/dragging'
import { JsonSchema, makeSchemaValidator } from 'utils/json-schema'
import * as spreadsheets from 'utils/spreadsheets'
import { readableBytes } from 'utils/string'
import * as workflows from 'utils/workflows'

import * as requests from '../requests'
import MetaInputErrorHelper from './MetaInputErrorHelper'
import SelectWorkflow from './SelectWorkflow'

export const MAX_UPLOAD_SIZE = 1000 * 1000 * 1000 // 1GB
export const MAX_S3_SIZE = 10 * 1000 * 1000 * 1000 // 10GB
export const MAX_META_FILE_SIZE = 10 * 1000 * 1000 // 10MB

export const ERROR_MESSAGES = {
  UPLOAD: 'Error uploading files',
  MANIFEST: 'Error creating manifest',
}

export const getNormalizedPath = (f: { path?: string; name: string }) => {
  const p = f.path || f.name
  return p.startsWith('/') ? p.substring(1) : p
}

export async function hashFile(file: File) {
  if (!window.crypto || !window.crypto.subtle || !window.crypto.subtle.digest)
    throw new Error('Crypto API unavailable')
  const buf = await file.arrayBuffer()
  const hashBuf = await window.crypto.subtle.digest('SHA-256', buf)
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function cacheDebounce<I extends [any, ...any[]], O, K extends string | number | symbol>(
  fn: (...args: I) => Promise<O>,
  wait: number,
  getKey: (...args: I) => K = R.identity as unknown as (...args: I) => K,
) {
  type Resolver = (result: Promise<O>) => void
  const cache = {} as Record<K, Promise<O>>
  let timer: null | ReturnType<typeof setTimeout>
  let resolveList: Resolver[] = []

  return (...args: I) => {
    const key = getKey(...args)
    if (key in cache) return cache[key]

    return new Promise((resolveNew: Resolver) => {
      if (timer) clearTimeout(timer)

      timer = setTimeout(() => {
        timer = null

        const result = fn(...args)
        cache[key] = result

        resolveList.forEach((resolve) => resolve(result))

        resolveList = []
      }, wait)

      resolveList.push(resolveNew)
    })
  }
}

const readTextFile = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onabort = () => {
      reject(new Error('abort'))
    }
    reader.onerror = () => {
      reject(reader.error)
    }
    reader.onload = () => {
      resolve(reader.result as string)
    }
    reader.readAsText(file)
  })

const readFile = (file: File, schema?: JsonSchema): Promise<string | {}> => {
  const mimeType = mime.extension(file.type)
  if (mimeType && /ods|odt|csv|xlsx|xls/.test(mimeType))
    return spreadsheets.readAgainstSchema(file, schema)
  return readTextFile(file)
}

interface ApiRequest {
  <O>(opts: {
    endpoint: string
    method?: 'GET' | 'PUT' | 'POST' | 'DELETE' | 'HEAD'
    body?: {}
  }): Promise<O>
}

const validateName = (req: ApiRequest) =>
  cacheDebounce(async (name: string) => {
    if (name) {
      const res = await req<{ valid: boolean }>({
        endpoint: '/package_name_valid',
        method: 'POST',
        body: { name },
      })
      if (!res.valid) return 'invalid'
    }
    return undefined
  }, 200)

export function useNameValidator() {
  const req: ApiRequest = APIConnector.use()
  const [counter, setCounter] = React.useState(0)
  const [processing, setProcessing] = React.useState(false)
  const inc = React.useCallback(() => setCounter(R.inc), [setCounter])

  const validator = React.useMemo(() => validateName(req), [req])

  const validate = React.useCallback(
    async (name: string) => {
      setProcessing(true)
      try {
        const error = await validator(name)
        setProcessing(false)
        return error
      } catch (e) {
        setProcessing(false)
        return e instanceof Error ? (e.message as string) : ''
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [counter, validator],
  )

  return React.useMemo(() => ({ validate, processing, inc }), [validate, processing, inc])
}

export function useNameExistence(bucket: string) {
  const [counter, setCounter] = React.useState(0)
  const inc = React.useCallback(() => setCounter(R.inc), [setCounter])

  const s3 = AWS.S3.use()

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const validate = React.useCallback(
    cacheDebounce(async (name: string) => {
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

export function mkMetaValidator(schema?: JsonSchema) {
  // TODO: move schema validation to utils/validators
  //       but don't forget that validation depends on library.
  //       Maybe we should split validators to files at first
  const schemaValidator = makeSchemaValidator(schema)
  return function validateMeta(value: object | null) {
    const jsonObjectErr = value && !R.is(Object, value)
    if (jsonObjectErr) {
      return new Error('Metadata must be a valid JSON object')
    }

    if (schema) {
      const errors = schemaValidator(value || {})
      if (errors.length) return errors
    }

    return undefined
  }
}

export type MetaValidator = ReturnType<typeof mkMetaValidator>

interface FieldProps {
  error?: string
  helperText?: React.ReactNode
  validating?: boolean
}

const useFieldInputStyles = M.makeStyles({
  root: {
    // It hides M.CircularProgress (spinning square) overflow
    overflow: 'hidden',
  },
})

export function Field({
  error,
  helperText,
  validating,
  ...rest
}: FieldProps & M.TextFieldProps) {
  const inputClasses = useFieldInputStyles()
  const props = {
    InputLabelProps: { shrink: true },
    InputProps: {
      endAdornment: validating && <M.CircularProgress size={20} />,
      classes: inputClasses,
    },
    error: !!error,
    helperText: error || helperText,
    ...rest,
  }
  return <M.TextField {...props} />
}

interface PackageNameInputOwnProps {
  errors: Record<string, React.ReactNode>
  input: RF.FieldInputProps<string>
  meta: RF.FieldMetaState<string>
  validating: boolean
}

type PackageNameInputProps = PackageNameInputOwnProps &
  Omit<Parameters<typeof Field>[0], keyof PackageNameInputOwnProps>

export function PackageNameInput({
  errors,
  input,
  meta,
  validating,
  ...rest
}: PackageNameInputProps) {
  const readyForValidation = (input.value && meta.modified) || meta.submitFailed
  const errorCode = readyForValidation && meta.error
  const error = errorCode ? errors[errorCode] || errorCode : ''
  const props = {
    disabled: meta.submitting || meta.submitSucceeded,
    error,
    fullWidth: true,
    label: 'Name',
    margin: 'normal' as const,
    placeholder: 'e.g. user/package',
    // NOTE: react-form doesn't change `FormState.validating` on async validation when field loses focus
    validating,
    ...input,
    ...rest,
  }
  return <Field {...props} />
}

interface CommitMessageInputOwnProps {
  errors: Record<string, React.ReactNode>
  input: RF.FieldInputProps<string>
  meta: RF.FieldMetaState<string>
}

type CommitMessageInputProps = CommitMessageInputOwnProps &
  Omit<Parameters<typeof Field>[0], keyof CommitMessageInputOwnProps>

export function CommitMessageInput({
  errors,
  input,
  meta,
  ...rest
}: CommitMessageInputProps) {
  const errorCode = meta.submitFailed && meta.error
  const error = errorCode ? errors[errorCode] || errorCode : ''
  const props = {
    disabled: meta.submitting || meta.submitSucceeded,
    error,
    fullWidth: true,
    label: 'Commit message',
    margin: 'normal' as const,
    placeholder: 'Enter a commit message',
    validating: meta.submitFailed && meta.validating,
    ...input,
    ...rest,
  }
  return <Field {...props} />
}

const useWorkflowInputStyles = M.makeStyles((t) => ({
  root: {
    marginTop: t.spacing(2),
  },
}))

interface WorkflowInputProps {
  input: RF.FieldInputProps<workflows.Workflow>
  meta: RF.FieldMetaState<workflows.Workflow>
  workflowsConfig?: workflows.WorkflowsConfig
  errors?: Record<string, React.ReactNode>
}

export function WorkflowInput({
  input,
  meta,
  workflowsConfig,
  errors = {},
}: WorkflowInputProps) {
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

export const defaultWorkflowFromConfig = (cfg?: workflows.WorkflowsConfig) =>
  cfg && cfg.workflows.find((item) => item.isDefault)

export function useWorkflowValidator(workflowsConfig?: workflows.WorkflowsConfig) {
  return React.useMemo(
    () => (workflow?: workflows.Workflow) => {
      if (!workflowsConfig?.isWorkflowRequired) return undefined
      if (workflow && workflow.slug !== workflows.notSelected) return undefined
      return 'required'
    },
    [workflowsConfig?.isWorkflowRequired],
  )
}

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
  errors: {
    marginTop: t.spacing(1),
  },
  jsonInput: {
    fontFamily: (t.typography as any).monospace.fontFamily,
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
    display: 'flex',
    flexDirection: 'column',
    overflowY: 'auto',
    position: 'relative',
  },
  outlined: {
    bottom: '1px',
    left: 0,
    outline: `2px dashed ${t.palette.primary.light}`,
    outlineOffset: '-2px',
    position: 'absolute',
    right: 0,
    top: '1px',
    zIndex: 1,
  },
  editor: {
    overflowY: 'auto',
  },
  overlay: {
    background: 'rgba(255,255,255,0.6)',
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    transition: 'background 0.15s ease',
    zIndex: 1,
  },
  overlayDraggable: {
    bottom: '3px',
    left: '2px',
    right: '2px',
    top: '3px',
  },
  overlayDragActive: {
    background: fade(t.palette.grey[200], 0.8),
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

export const EMPTY_META_VALUE = {}

interface MetaInputProps {
  className?: string
  schemaError: React.ReactNode
  input: RF.FieldInputProps<{}>
  meta: RF.FieldMetaState<{}>
  schema?: JsonSchema
}

type Mode = 'kv' | 'json'

// TODO: warn on duplicate keys
export const MetaInput = React.forwardRef<HTMLDivElement, MetaInputProps>(
  function MetaInput(
    { className, schemaError, input: { value, onChange }, meta, schema },
    ref,
  ) {
    const classes = useMetaInputStyles()
    const error = schemaError || ((meta.modified || meta.submitFailed) && meta.error)
    const disabled = meta.submitting || meta.submitSucceeded
    const [mode, setMode] = React.useState<Mode>('kv')

    const [textValue, setTextValue] = React.useState(() => stringifyJSON(value))

    const changeText = React.useCallback(
      (text) => {
        if (disabled) return
        setTextValue(text)
        onChange(parseJSON(text))
      },
      [disabled, onChange],
    )

    const handleModeChange = (_e: unknown, m: Mode) => {
      if (!m) return
      setMode(m)
    }

    const handleTextChange = (e: React.ChangeEvent<{ value: string }>) => {
      changeText(e.target.value)
    }

    const onJsonEditor = React.useCallback(
      (json: {}) => {
        setTextValue(stringifyJSON(json))
        onChange(json)
      },
      [onChange],
    )

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
        readFile(file, schema)
          .then((contents: string | {}) => {
            if (R.is(Object, contents)) {
              onJsonEditor(contents)
            } else {
              try {
                JSON.parse(contents as string)
              } catch (e) {
                notify('The file does not contain valid JSON')
              }
              changeText(contents)
            }
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
      [schema, setLocked, changeText, onJsonEditor, setJsonEditorKey, notify],
    )

    const isDragging = useDragging()

    const { getRootProps, isDragActive } = useDropzone({ onDrop })

    return (
      <div className={className}>
        <div className={classes.header}>
          {/* eslint-disable-next-line no-nested-ternary */}
          <M.Typography color={disabled ? 'textSecondary' : error ? 'error' : undefined}>
            Metadata
          </M.Typography>

          <M.Box flexGrow={1} />
          <Lab.ToggleButtonGroup value={mode} exclusive onChange={handleModeChange}>
            <Lab.ToggleButton value="kv" className={classes.btn} disabled={disabled}>
              Key : Value
            </Lab.ToggleButton>
            <Lab.ToggleButton value="json" className={classes.btn} disabled={disabled}>
              JSON
            </Lab.ToggleButton>
          </Lab.ToggleButtonGroup>
        </div>

        <div {...getRootProps({ className: classes.dropzone })} tabIndex={undefined}>
          {isDragging && <div className={classes.outlined} />}

          {mode === 'kv' ? (
            <JsonEditor
              className={classes.editor}
              disabled={disabled}
              value={value}
              onChange={onJsonEditor}
              schema={schema}
              key={jsonEditorKey}
              ref={ref}
            />
          ) : (
            <M.TextField
              variant="outlined"
              size="small"
              value={textValue}
              onChange={handleTextChange}
              error={!!error}
              fullWidth
              multiline
              placeholder="Enter JSON metadata if necessary"
              rowsMax={10}
              InputProps={{ classes: { input: classes.jsonInput } }}
              disabled={disabled}
            />
          )}

          <MetaInputErrorHelper className={classes.errors} error={error} />

          {locked && (
            <div className={classes.overlay}>
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
            </div>
          )}

          {isDragging && (
            <div
              className={cx(classes.overlay, classes.overlayDraggable, {
                [classes.overlayDragActive]: isDragActive,
              })}
            >
              <div className={classes.overlayContents}>
                <div className={classes.overlayText}>
                  Drop metadata file (XLSX, CSV, JSON)
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  },
)

export interface SchemaFetcherRenderPropsLoading {
  responseError: undefined
  schema: undefined
  schemaLoading: true
  selectedWorkflow: workflows.Workflow | undefined
  validate: MetaValidator
}

export interface SchemaFetcherRenderPropsSuccess {
  responseError: undefined
  schema?: JsonSchema
  schemaLoading: false
  selectedWorkflow: workflows.Workflow | undefined
  validate: MetaValidator
}

export interface SchemaFetcherRenderPropsError {
  responseError: Error
  schema: undefined
  schemaLoading: false
  selectedWorkflow: workflows.Workflow | undefined
  validate: MetaValidator
}

export type SchemaFetcherRenderProps =
  | SchemaFetcherRenderPropsLoading
  | SchemaFetcherRenderPropsSuccess
  | SchemaFetcherRenderPropsError

const noopValidator: MetaValidator = () => undefined

interface SchemaFetcherProps {
  manifest?: {
    workflow?: {
      id?: string
    }
  }
  workflow?: workflows.Workflow
  workflowsConfig: workflows.WorkflowsConfig
  children: (props: SchemaFetcherRenderProps) => React.ReactElement
}

export function SchemaFetcher({
  manifest,
  workflow,
  workflowsConfig,
  children,
}: SchemaFetcherProps) {
  const s3 = AWS.S3.use()
  const sentry = Sentry.use()

  const slug = manifest?.workflow?.id

  const initialWorkflow = React.useMemo(() => {
    // reuse workflow from previous revision if it's still present in the config
    if (slug) {
      const w = workflowsConfig.workflows.find(R.propEq('slug', slug))
      if (w) return w
    }
    return defaultWorkflowFromConfig(workflowsConfig)
  }, [slug, workflowsConfig])

  const selectedWorkflow = workflow || initialWorkflow

  if (!selectedWorkflow) {
    const error = new Error(`"default_workflow" or "workflow.id" doesn't exist`)
    sentry('captureException', error)
    // eslint-disable-next-line no-console
    console.error(error)
  }

  const schemaUrl = R.pathOr('', ['schema', 'url'], selectedWorkflow)
  const data = useData(requests.metadataSchema, { s3, schemaUrl })

  const res: SchemaFetcherRenderProps = React.useMemo(
    () =>
      data.case({
        Ok: (schema?: JsonSchema) =>
          ({
            schema,
            schemaLoading: false,
            selectedWorkflow,
            validate: mkMetaValidator(schema),
          } as SchemaFetcherRenderPropsSuccess),
        Err: (responseError: Error) =>
          ({
            responseError,
            schemaLoading: false,
            selectedWorkflow,
            validate: mkMetaValidator(),
          } as SchemaFetcherRenderPropsError),
        _: () =>
          ({
            schemaLoading: true,
            selectedWorkflow,
            validate: noopValidator,
          } as SchemaFetcherRenderPropsLoading),
      }),
    [data, selectedWorkflow],
  )
  return children(res)
}

export function useCryptoApiValidation() {
  return React.useCallback(() => {
    const isCryptoApiAvailable =
      window.crypto && window.crypto.subtle && window.crypto.subtle.digest
    return {
      [FORM_ERROR]: !isCryptoApiAvailable
        ? 'Quilt requires the Web Cryptography API. Please try another browser.'
        : undefined,
    }
  }, [])
}

export function calcDialogHeight(windowHeight: number, metaHeight: number): number {
  const neededSpace = 400 /* space to fit other inputs */ + metaHeight
  const availableSpace = windowHeight - 200 /* free space for headers */
  const minimalSpace = 420 /* minimal height */
  if (availableSpace < minimalSpace) return minimalSpace
  return R.clamp(minimalSpace, availableSpace, neededSpace)
}

export const useContentStyles = M.makeStyles({
  root: {
    height: ({ metaHeight }: { metaHeight: number }) =>
      calcDialogHeight(window.innerHeight, metaHeight),
    paddingTop: 0,
  },
})

export function getUsernamePrefix(username?: string | null) {
  if (!username) return ''
  const name = username.includes('@') ? username.split('@')[0] : username
  // see PACKAGE_NAME_FORMAT at quilt3/util.py
  const validParts = name.match(/\w+/g)
  return validParts ? `${validParts.join('')}/` : ''
}

const usePackageNameWarningStyles = M.makeStyles({
  root: {
    marginRight: '4px',
    verticalAlign: '-5px',
  },
})

interface PackageNameWarningProps {
  exists?: boolean
}

export const PackageNameWarning = ({ exists }: PackageNameWarningProps) => {
  const classes = usePackageNameWarningStyles()
  return (
    <>
      <M.Icon className={classes.root} fontSize="small">
        info_outlined
      </M.Icon>
      {exists ? 'Existing package' : 'New package'}
    </>
  )
}

interface DialogWrapperProps {
  exited: boolean
}

export function DialogWrapper({
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
