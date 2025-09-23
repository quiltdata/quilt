import { basename } from 'path'

import type { ErrorObject } from 'ajv'
import * as R from 'ramda'
import * as React from 'react'
import * as urql from 'urql'
import * as M from '@material-ui/core'
import { RestoreOutlined as IconRestoreOutlined } from '@material-ui/icons'
import * as Lab from '@material-ui/lab'

import cfg from 'constants/config'
import * as APIConnector from 'utils/APIConnector'
import * as AWS from 'utils/AWS'
import * as JSONPointer from 'utils/JSONPointer'
import log from 'utils/Logging'
import StyledLink from 'utils/StyledLink'
import assertNever from 'utils/assertNever'
import { mkFormError } from 'utils/formTools'
import {
  JsonSchema,
  makeSchemaDefaultsSetter,
  makeSchemaValidator,
} from 'utils/JSONSchema'
import * as packageHandleUtils from 'utils/packageHandle'
import * as s3paths from 'utils/s3paths'
import { JsonRecord } from 'utils/types'
import * as workflows from 'utils/workflows'

import * as requests from '../requests'
import * as State from './state'
import PACKAGE_EXISTS_QUERY from './gql/PackageExists.generated'

export const MAX_UPLOAD_SIZE = 20 * 1000 * 1000 * 1000 // 20GB
// XXX: keep in sync w/ the backend
// NOTE: these limits are lower than the actual "hard" limits on the backend
export const MAX_S3_SIZE = cfg.chunkedChecksums
  ? 5 * 10 ** 12 // 5 TB
  : 50 * 10 ** 9 // 50 GB
export const MAX_FILE_COUNT = 1000

export const ERROR_MESSAGES = {
  UPLOAD: 'Error uploading files',
  MANIFEST: 'Error creating manifest',
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
  const client = urql.useClient()
  const validate = React.useCallback(
    async (name: string) => {
      if (name) {
        const res = await client
          .query(
            PACKAGE_EXISTS_QUERY,
            { bucket, name },
            { requestPolicy: 'network-only' },
          )
          .toPromise()
        if (res.data?.package) return 'exists'
      }
      return undefined
    },
    [bucket, client],
  )
  return cacheDebounce(validate, 200)
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
      const setDefaults = makeSchemaDefaultsSetter(schema)
      const errors = schemaValidator(setDefaults(value || {}))
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

// TODO: re-use components/Form/TextField
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

export const defaultWorkflowFromConfig = (wcfg?: workflows.WorkflowsConfig) =>
  wcfg?.workflows.find((item) => item.isDefault)

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

export function useCryptoApiValidation() {
  return React.useCallback(
    () =>
      !!window.crypto?.subtle?.digest
        ? {}
        : mkFormError(
            'Quilt requires the Web Cryptography API. Please try another browser.',
          ),

    [],
  )
}

export function calcDialogHeight(windowHeight: number, metaHeight: number): number {
  const neededSpace = 345 /* space to fit other inputs */ + metaHeight
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

export const getDefaultPackageName = (
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

const usePackageNameWarningStyles = M.makeStyles((t) => ({
  root: {
    marginRight: '4px',
    verticalAlign: '-5px',
  },
  success: {
    color: t.palette.success.main,
  },
  error: {
    color: t.palette.error.main,
  },
  existing: {
    color: t.palette.text.hint,
  },
}))

export const PackageNameWarning = () => {
  const {
    values: {
      name: { status },
    },
    setSrc,
  } = State.use()
  const classes = usePackageNameWarningStyles()

  switch (status._tag) {
    case 'idle':
      return <></>
    case 'loading':
      return <Lab.Skeleton width={160} />
    case 'new-revision':
      return <span className={classes.existing}>Existing package</span>
    case 'exists':
      return (
        <>
          <IconRestoreOutlined className={classes.root} fontSize="small" />
          Existing package. Want to{' '}
          <StyledLink onClick={() => setSrc(status.dst)}>load and revise it</StyledLink>?
        </>
      )
    case 'new':
      return <span className={classes.success}>New package</span>
    case 'error':
      return <>{status.error.message}</>
    default:
      assertNever(status)
  }
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

function isAjvError(e: Error | ErrorObject): e is ErrorObject {
  return !!(e as ErrorObject).instancePath
}

export function isEntryError(e: Error | ErrorObject): e is EntryValidationError {
  return !!(e as EntryValidationError)?.data?.logical_key
}

function useFetchEntriesSchema(workflow?: workflows.Workflow) {
  const s3 = AWS.S3.use()
  return React.useMemo(async () => {
    const schemaUrl = workflow?.entriesSchema
    if (!schemaUrl) return null
    return requests.objectSchema({ s3, schemaUrl })
  }, [s3, workflow])
}

export interface ValidationEntry {
  logical_key: string
  size: number
  meta?: JsonRecord
}

interface EntryValidationError extends ErrorObject {
  data: ValidationEntry
}

export type EntriesValidationErrors = (Error | EntryValidationError)[]

export const EMPTY_ENTRIES_ERRORS: EntriesValidationErrors = []

function injectEntryIntoErrors(
  errors: (Error | ErrorObject)[],
  entries: ValidationEntry[],
): EntriesValidationErrors {
  if (!errors?.length) return errors as Error[]
  return errors.map((error) => {
    if (!isAjvError(error)) return error
    try {
      const pointer = JSONPointer.parse(error.instancePath)
      // `entries` value is an array,
      // so the first item of the pointer is an index
      const index: number = Number(pointer[0] as string)
      error.data = entries[index]
      return error as EntryValidationError
    } catch (e) {
      log.debug(e)
      return error instanceof Error ? error : new Error('Unknown error')
    }
  })
}

export function useEntriesValidator(workflow?: workflows.Workflow) {
  const entriesSchemaAsync = useFetchEntriesSchema(workflow)

  return React.useCallback(
    async (entries: ValidationEntry[]) => {
      const entriesSchema = await entriesSchemaAsync
      // TODO: Show error if there is network error
      if (!entriesSchema) return undefined

      const errors = makeSchemaValidator(entriesSchema)(entries)
      return injectEntryIntoErrors(errors, entries)
    },
    [entriesSchemaAsync],
  )
}
