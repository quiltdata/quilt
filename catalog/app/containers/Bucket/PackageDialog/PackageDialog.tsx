import { basename } from 'path'

import { FORM_ERROR } from 'final-form'
import * as R from 'ramda'
import * as React from 'react'
import type * as RF from 'react-final-form'
import * as redux from 'react-redux'
import * as M from '@material-ui/core'

import * as authSelectors from 'containers/Auth/selectors'
import { useData } from 'utils/Data'
import * as APIConnector from 'utils/APIConnector'
import * as AWS from 'utils/AWS'
import * as Sentry from 'utils/Sentry'
import { JsonSchema, makeSchemaValidator } from 'utils/json-schema'
import * as packageHandleUtils from 'utils/packageHandle'
import * as s3paths from 'utils/s3paths'
import * as workflows from 'utils/workflows'

import * as requests from '../requests'
import SelectWorkflow from './SelectWorkflow'

export const MAX_UPLOAD_SIZE = 20 * 1000 * 1000 * 1000 // 20GB
export const MAX_S3_SIZE = 50 * 1000 * 1000 * 1000 // 50GB
export const MAX_FILE_COUNT = 1000

export const ERROR_MESSAGES = {
  UPLOAD: 'Error uploading files',
  MANIFEST: 'Error creating manifest',
}

export const getNormalizedPath = (f: { path?: string; name: string }) => {
  const p = f.path || f.name
  return p.startsWith('/') ? p.substring(1) : p
}

export async function hashFile(file: File) {
  if (!window.crypto?.subtle?.digest) throw new Error('Crypto API unavailable')
  const buf = await file.arrayBuffer()
  // XXX: consider using hashwasm for stream-based hashing to support larger files
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

export function useNameValidator(workflow?: workflows.Workflow) {
  const req: ApiRequest = APIConnector.use()
  const [counter, setCounter] = React.useState(0)
  const [processing, setProcessing] = React.useState(false)
  const inc = React.useCallback(() => setCounter(R.inc), [setCounter])

  const validator = React.useMemo(() => validateName(req), [req])

  const validate = React.useCallback(
    async (name: string) => {
      if (workflow?.packageNamePattern?.test(name) === false) {
        return 'pattern'
      }

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
    [counter, validator, workflow?.packageNamePattern],
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
  directory?: string
  meta: RF.FieldMetaState<string>
  validating: boolean
  workflow: { packageName: packageHandleUtils.NameTemplates }
}

type PackageNameInputProps = PackageNameInputOwnProps &
  Omit<Parameters<typeof Field>[0], keyof PackageNameInputOwnProps>

export function PackageNameInput({
  errors,
  input: { value, onChange },
  meta,
  workflow,
  directory,
  validating,
  ...rest
}: PackageNameInputProps) {
  const readyForValidation = (value && meta.modified) || meta.submitFailed
  const errorCode = readyForValidation && meta.error
  const error = errorCode ? errors[errorCode] || errorCode : ''
  const [modified, setModified] = React.useState(!!(meta.modified || value))
  const handleChange = React.useCallback(
    (event) => {
      setModified(true)
      onChange(event)
    },
    [onChange, setModified],
  )
  const props = {
    disabled: meta.submitting || meta.submitSucceeded,
    error,
    fullWidth: true,
    label: 'Name',
    margin: 'normal' as const,
    onChange: handleChange,
    placeholder: 'e.g. user/package',
    // NOTE: react-form doesn't change `FormState.validating` on async validation when field loses focus
    validating,
    value,
    ...rest,
  }
  const username = redux.useSelector(authSelectors.username)
  React.useEffect(() => {
    if (modified) return

    const packageName = getDefaultPackageName(workflow, {
      username,
      directory,
    })
    if (!packageName) return

    onChange({
      target: {
        value: packageName,
      },
    })
  }, [directory, workflow, modified, onChange, username])
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
  const disabled = meta.submitting || meta.submitSucceeded
  const errorKey = meta.submitFailed && meta.error

  return (
    <SelectWorkflow
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

export function calcDialogHeight(
  windowHeight: number,
  metaHeight: number,
  metaFullHeight?: boolean,
): number {
  const neededSpace =
    (metaFullHeight ? 125 : 345) /* space to fit other inputs */ + metaHeight
  const availableSpace = windowHeight - 200 /* free space for headers */
  const minimalSpace = 420 /* minimal height */
  if (availableSpace < minimalSpace) return minimalSpace
  return R.clamp(minimalSpace, availableSpace, neededSpace)
}

export const useContentStyles = M.makeStyles({
  root: {
    height: ({
      metaHeight,
      metaFullHeight,
    }: {
      metaHeight: number
      metaFullHeight?: boolean
    }) => calcDialogHeight(window.innerHeight, metaHeight, metaFullHeight),
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

const getDefaultPackageName = (
  workflow: { packageName: packageHandleUtils.NameTemplates },
  { directory, username }: { directory?: string; username: string },
) => {
  const usernamePrefix = getUsernamePrefix(username)
  const templateBasedName =
    typeof directory === 'string'
      ? packageHandleUtils.execTemplate(workflow?.packageName, 'files', {
          directory: basename(directory),
          username: s3paths.ensureNoSlash(usernamePrefix),
        })
      : packageHandleUtils.execTemplate(workflow?.packageName, 'packages', {
          username: s3paths.ensureNoSlash(usernamePrefix),
        })
  return typeof templateBasedName === 'string' ? templateBasedName : usernamePrefix
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

export function useEntriesValidator(workflow?: workflows.Workflow) {
  const s3 = AWS.S3.use()

  return React.useCallback(
    async (entries: $TSFixMe) => {
      const schemaUrl = workflow?.entriesSchema
      if (!schemaUrl) return undefined
      const entriesSchema = await requests.objectSchema({ s3, schemaUrl })
      // TODO: Show error if there is network error
      if (!entriesSchema) return undefined

      return makeSchemaValidator(entriesSchema)(entries)
    },
    [workflow, s3],
  )
}
