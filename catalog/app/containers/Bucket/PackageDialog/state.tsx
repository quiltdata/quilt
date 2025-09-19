import { basename } from 'path'

import type { ErrorObject } from 'ajv'
import invariant from 'invariant'
import * as React from 'react'
import * as redux from 'react-redux'

import * as authSelectors from 'containers/Auth/selectors'
import * as APIConnector from 'utils/APIConnector'
import * as AWS from 'utils/AWS'
import * as GQL from 'utils/GraphQL'
import {
  JsonSchema,
  makeSchemaDefaultsSetter,
  makeSchemaValidator,
} from 'utils/JSONSchema'
import type { NameTemplates, PackageHandle } from 'utils/packageHandle'
import { execTemplate } from 'utils/packageHandle'
import * as s3paths from 'utils/s3paths'
import { JsonRecord } from 'utils/types'
import * as Request from 'utils/useRequest'
import * as workflows from 'utils/workflows'

import * as requests from '../requests'

import { Manifest, useManifest } from './Manifest'
import * as FI from './FilesInput'

export function mkMetaValidator(schema?: JsonSchema) {
  const schemaValidator = makeSchemaValidator(schema)
  if (!schema) return () => undefined
  return function validateMeta(value: JsonRecord): (ErrorObject | Error)[] | undefined {
    // const jsonObjectErr = value && !R.is(Object, value)
    // if (jsonObjectErr) {
    //   return new Error('Metadata must be a valid JSON object')
    // }

    //if (schema) {
    const setDefaults = makeSchemaDefaultsSetter(schema)
    const errors = schemaValidator(setDefaults(value))
    if (errors.length) return errors
    //}

    // return undefined
  }
}

export function getUsernamePrefix(username?: string | null) {
  if (!username) return ''
  const name = username.includes('@') ? username.split('@')[0] : username
  // see PACKAGE_NAME_FORMAT at quilt3/util.py
  const validParts = name.match(/\w+/g)
  return validParts ? `${validParts.join('')}/` : ''
}

export const getDefaultPackageName = (
  workflow: { packageName: NameTemplates },
  { directory, username }: { directory?: string; username: string },
) => {
  const usernamePrefix = getUsernamePrefix(username)
  const templateBasedName =
    typeof directory === 'string'
      ? execTemplate(workflow?.packageName, 'files', {
          directory: basename(directory),
          username: s3paths.ensureNoSlash(usernamePrefix),
        })
      : execTemplate(workflow?.packageName, 'packages', {
          username: s3paths.ensureNoSlash(usernamePrefix),
        })
  return typeof templateBasedName === 'string' ? templateBasedName : usernamePrefix
}

import PACKAGE_EXISTS_QUERY from './gql/PackageExists.generated'

type FormStatus =
  | { _tag: 'idle' }
  | { _tag: 'ready' }
  | { _tag: 'submitting' }
  | {
      _tag: 'submitFailed'
      error: Error
      fields: {
        workflow?: Error
        meta?: Error
        files?: Error
        message?: Error
        name?: Error
      }
    }

type AsyncStatus =
  | { _tag: 'idle' }
  | { _tag: 'loading' }
  | { _tag: 'error'; error: Error }

type InputStatus = { _tag: 'error'; error: Error } | { _tag: 'ok' }

type NameStatus =
  | { _tag: 'new-revision' }
  | { _tag: 'exists'; dst: Required<PackageDst> }
  | { _tag: 'new' }
  | Exclude<NameValidationStatus, { _tag: 'ok' }>

type NameValidationStatus = AsyncStatus | { _tag: 'ok' }

type ManifestStatus = AsyncStatus | { _tag: 'ready'; manifest: Manifest | undefined }

type WorkflowsConfigStatus =
  | { _tag: 'idle' }
  | { _tag: 'loading'; config: /*empty config as fallback*/ workflows.WorkflowsConfig }
  | {
      _tag: 'error'
      error: Error
      config: /*empty config as fallback*/ workflows.WorkflowsConfig
    }
  | { _tag: 'ready'; config: workflows.WorkflowsConfig }

type WorkflowStatus =
  | { _tag: 'loading' }
  | { _tag: 'error'; error: Error }
  | { _tag: 'ok' }

type SchemaStatus =
  | { _tag: 'idle' }
  | { _tag: 'loading' }
  | { _tag: 'error'; error: Error }
  | { _tag: 'ready'; schema?: JsonSchema }

interface PackageSrc {
  bucket: string
  name: string
  hash?: string
}

interface PackageDst {
  bucket: string
  name?: string
}

type MessageStatus = InputStatus
type MetaStatus = { _tag: 'error'; errors: (Error | ErrorObject)[] } | { _tag: 'ok' }

interface PackageDialogState {
  values: {
    files: {
      onChange: (f: Partial<FI.FilesState>) => void
      value: FI.FilesState
    }
    message: {
      onChange: (m: string) => void
      status: MessageStatus
      value: string | undefined
    }
    meta: {
      onChange: (m: JsonRecord) => void
      status: MetaStatus
      value: JsonRecord | undefined
    }
    name: {
      onChange: (n: string) => void
      status: NameStatus
      value: string | undefined
    }
    workflow: {
      onChange: (w: workflows.Workflow) => void
      status: WorkflowStatus
      value: workflows.Workflow | undefined
    }
  }
  src?: PackageSrc
  setSrc: (src: PackageSrc) => void
  reset: () => void
  open: boolean | FI.FilesState['added']
  setOpen: (o: boolean | FI.FilesState['added']) => void

  manifest: ManifestStatus
  workflowsConfig: WorkflowsConfigStatus
  schema: SchemaStatus

  submit: () => Promise<PackageHandle>
}

const Context = React.createContext<PackageDialogState | null>(null)

export function useContext(): PackageDialogState {
  const context = React.useContext(Context)
  invariant(context, 'useContext must be used within PackageDialogProvider')
  return context
}

export const use = useContext

function useNameExistence(dst: PackageDst, src?: PackageSrc): NameStatus {
  const pause =
    !dst.bucket || !dst.name || (dst.bucket === src?.bucket && dst.name === src.name)
  const packageExistsQuery = GQL.useQuery(
    PACKAGE_EXISTS_QUERY,
    dst as Required<PackageDst>,
    { pause },
  )
  return React.useMemo(() => {
    if (!dst.bucket || !dst.name) return { _tag: 'idle' }
    if (dst.bucket === src?.bucket && dst.name === src.name) {
      return { _tag: 'new-revision' }
    }
    return GQL.fold(packageExistsQuery, {
      data: ({ package: r }) => {
        if (!r) return { _tag: 'new' }
        switch (r.__typename) {
          default:
            return { _tag: 'exists', dst: { bucket: dst.bucket, name: r.name } }
        }
      },
      fetching: () => ({ _tag: 'loading' }),
      error: (error) => ({ _tag: 'error', error }),
    })
  }, [dst, packageExistsQuery, src])
}

function useNameValidator(dst: PackageDst): NameValidationStatus {
  const apiReq = APIConnector.use()
  const req = React.useCallback(async () => {
    const res = await apiReq({
      endpoint: '/package_name_valid',
      method: 'POST',
      body: { name: dst.name },
    })
    return res.valid
      ? { _tag: 'ok' as const }
      : { _tag: 'error' as const, error: new Error('Invalid package name') }
  }, [apiReq, dst.name])
  const result = Request.use(req, !!dst.name)
  return React.useMemo(() => {
    if (result === Request.Idle) return { _tag: 'idle' }
    if (result === Request.Loading) return { _tag: 'loading' }
    if (result instanceof Error) return { _tag: 'error', error: result }
    return result
  }, [result])
}

function validateNamePattern(
  dst: PackageDst,
  workflow?: workflows.Workflow,
): NameValidationStatus {
  if (!dst.name) return { _tag: 'error', error: new Error('Enter a package name') }
  if (workflow?.packageNamePattern?.test(dst.name) === false) {
    return {
      _tag: 'error',
      error: new Error(`Name should match ${workflow?.packageNamePattern}`),
    }
  }
  return { _tag: 'ok' }
}

function useNameStatus(
  form: FormStatus,
  dirty: boolean,
  dst: PackageDst,
  src?: PackageSrc,
  workflow?: workflows.Workflow,
): NameStatus {
  const existence = useNameExistence(dst, src)
  const validation = useNameValidator(dst)
  return React.useMemo(() => {
    if (form._tag === 'submitFailed' && form.fields.name) {
      return { _tag: 'error', error: form.fields.name }
    }
    if (form._tag === 'submitFailed' || dirty) {
      const namePatternValidation = validateNamePattern(dst, workflow)
      if (namePatternValidation._tag !== 'ok') return namePatternValidation
      if (validation._tag !== 'ok') return validation
    }
    return existence
  }, [dirty, form, dst, existence, workflow, validation])
}

function useNameFallback(workflow?: workflows.Workflow) {
  const username = redux.useSelector(authSelectors.username)
  if (!workflow) return undefined
  return getDefaultPackageName(workflow, {
    username,
  })
}

function useName(
  form: FormStatus,
  dst: PackageDst,
  setDst: React.Dispatch<React.SetStateAction<PackageDst>>,
  src?: PackageSrc,
  workflow?: workflows.Workflow,
) {
  const [dirty, setDirty] = React.useState(false)
  const nameFallback = useNameFallback(workflow)
  React.useEffect(() => {
    if (typeof dst.name === 'undefined') {
      setDst((d) => ({ ...d, name: nameFallback }))
    }
  }, [nameFallback, dst.name, setDst])

  const nameStatus = useNameStatus(form, dirty, dst, src, workflow)
  return React.useMemo(
    () => ({
      value: dst.name,
      status: nameStatus,
      onChange: (n: string) => {
        setDirty(true)
        setDst((d) => ({ ...d, name: n }))
      },
    }),
    [dst, nameStatus, setDst],
  )
}

function useManifestRequest(open: boolean, src?: PackageSrc): ManifestStatus {
  const pause = !src || !open
  const data = useManifest({
    bucket: src?.bucket || '',
    name: src?.name || '',
    hashOrTag: src?.hash,
    pause,
  })
  return React.useMemo(() => {
    if (!open) return { _tag: 'idle' }
    if (!src) return { _tag: 'ready' }
    return data.case({
      Ok: (manifest: Manifest | undefined) => ({ _tag: 'ready', manifest }),
      Pending: () => ({ _tag: 'loading' }),
      Init: () => ({ _tag: 'idle' }),
      Err: (error: Error) => ({ _tag: 'error', error }),
    })
  }, [src, open, data])
}

function useWorkflowsConfig(
  open: boolean,
  { bucket }: PackageDst,
): WorkflowsConfigStatus {
  const s3 = AWS.S3.use()
  const req = React.useCallback(
    () => requests.workflowsConfig({ s3, bucket }),
    [bucket, s3],
  )
  const result = Request.use(req, open)

  if (result === Request.Idle) {
    return { _tag: 'idle' }
  }
  if (result === Request.Loading) {
    return { _tag: 'loading', config: workflows.emptyConfig }
  }
  if (result instanceof Error) {
    return { _tag: 'error', error: result, config: workflows.emptyConfig }
  }

  return { _tag: 'ready', config: result }
}

function useWorkflowSchema(workflow?: workflows.Workflow): SchemaStatus {
  const s3 = AWS.S3.use()
  const schemaUrl = workflow?.schema?.url
  const req = React.useCallback(
    () => requests.metadataSchema({ s3, schemaUrl }),
    [schemaUrl, s3],
  )
  const result = Request.use(req, !!schemaUrl)

  if (result === Request.Idle) return { _tag: 'idle' }
  if (result === Request.Loading) return { _tag: 'loading' }
  if (result instanceof Error) return { _tag: 'error', error: result }

  return { _tag: 'ready', schema: result }
}

function getWorkflowFallback(manifest: ManifestStatus, config: WorkflowsConfigStatus) {
  if (config._tag !== 'ready') return undefined
  if (manifest._tag !== 'ready') return undefined

  const workflowId = manifest.manifest?.workflowId
  if (workflowId) {
    const found = config.config.workflows.find((w) => w.slug === workflowId)
    if (found) return found
  }
  return config.config.workflows.find((w) => w.isDefault)
}

function useWorkflow(manifest: ManifestStatus, config: WorkflowsConfigStatus) {
  const [workflow, setWorkflow] = React.useState<workflows.Workflow>()
  const value = React.useMemo(
    () => workflow || getWorkflowFallback(manifest, config),
    [config, manifest, workflow],
  )
  const status: WorkflowStatus = React.useMemo(() => {
    if (config._tag !== 'ready') return { _tag: 'loading' }
    if (
      config.config.isWorkflowRequired &&
      (!value || value.slug === workflows.notSelected)
    ) {
      return { _tag: 'error', error: new Error('Workflow is required for this bucket.') }
    }
    return { _tag: 'ok' }
  }, [config, value])
  return React.useMemo(() => ({ onChange: setWorkflow, status, value }), [status, value])
}

function useMessage(form: FormStatus) {
  const [message, setMessage] = React.useState<string>()
  const status: MessageStatus = React.useMemo(() => {
    if (form._tag !== 'submitFailed') return { _tag: 'ok' }
    if (form.fields.message) return { _tag: 'error', error: form.fields.message }
    if (!message) return { _tag: 'error', error: new Error('Enter a commit message') }
    return { _tag: 'ok' }
  }, [message, form])
  return React.useMemo(
    () => ({ value: message, status, onChange: setMessage }),
    [message, status],
  )
}

function getMetaFallback(manifest: ManifestStatus) {
  if (manifest._tag !== 'ready') return undefined
  return manifest.manifest?.meta
}

function useMeta(form: FormStatus, schema: SchemaStatus, manifest: ManifestStatus) {
  const [meta, setMeta] = React.useState<JsonRecord>()
  const value = React.useMemo(() => meta || getMetaFallback(manifest), [manifest, meta])
  const validate = React.useMemo(() => {
    if (schema._tag === 'error') return () => [schema.error]
    if (schema._tag !== 'ready') return () => [new Error('Schema is not ready')]
    return mkMetaValidator(schema.schema)
  }, [schema])
  const status: MetaStatus = React.useMemo(() => {
    if (form._tag !== 'submitFailed') return { _tag: 'ok' }
    if (form.fields.meta) return { _tag: 'error', errors: [form.fields.meta] }
    const errors = validate(meta || {})
    if (!errors) return { _tag: 'ok' }
    return { _tag: 'error', errors }
  }, [form, meta, validate])
  return React.useMemo(() => ({ value, status, onChange: setMeta }), [status, value])
}

function mergeFiles(manifest: ManifestStatus, files?: Partial<FI.FilesState>) {
  const existing = manifest._tag === 'ready' ? manifest.manifest?.entries || {} : {}
  return {
    existing,
    added: files?.added || {},
    deleted: files?.deleted || {},
  }
}

function useFiles(manifest: ManifestStatus, open: boolean | FI.FilesState['added']) {
  const [files, setFiles] = React.useState<Partial<FI.FilesState>>({ added: {} })
  const value = React.useMemo(() => mergeFiles(manifest, files), [manifest, files])
  React.useEffect(() => {
    if (typeof open === 'object') {
      setFiles({ added: open })
    }
  }, [open])
  return React.useMemo(() => ({ value, onChange: setFiles }), [value])
}

interface PackageDialogProviderProps {
  children: React.ReactNode
  src?: PackageSrc
  dst: PackageDst
  open?: boolean | FI.FilesState['added']
}

export function PackageDialogProvider({
  children,
  dst: initialDst,
  src: initialSrc,
  open: initialOpen = false,
}: PackageDialogProviderProps) {
  const [open, setOpen] = React.useState(initialOpen)

  const [formStatus, setFormStatus] = React.useState<FormStatus>(
    initialOpen ? { _tag: 'ready' } : { _tag: 'idle' },
  )

  const [src, setSrc] = React.useState(initialSrc)
  const [dst, setDst] = React.useState(initialDst)

  const reset = React.useCallback(() => {
    setSrc(initialSrc)
    setDst(initialDst)
  }, [initialSrc, initialDst])
  React.useEffect(() => reset(), [reset])

  const manifest = useManifestRequest(!!open, src)
  const workflowsConfig = useWorkflowsConfig(!!open, dst)

  const workflow = useWorkflow(manifest, workflowsConfig)

  const schema = useWorkflowSchema(workflow.value)

  const name = useName(formStatus, dst, setDst, src, workflow.value)
  const message = useMessage(formStatus)
  const meta = useMeta(formStatus, schema, manifest)
  const files = useFiles(manifest, open)

  const submit = React.useCallback(() => {
    // eslint-disable-next-line no-console
    console.log(
      files.value,
      message.value,
      meta.value,
      name.value,
      workflow.value,
      schema,
    )
    const error = new Error('Not implemented')
    setFormStatus({
      _tag: 'submitFailed',
      error,
      fields: {},
    })
    return Promise.reject(error)
  }, [files.value, message.value, meta.value, name.value, workflow.value, schema])

  return (
    <Context.Provider
      value={{
        values: {
          files,
          message,
          meta,
          name,
          workflow,
        },

        reset,

        src,
        setSrc,

        open,
        setOpen,

        manifest,
        workflowsConfig,
        schema,

        submit,
      }}
    >
      {children}
    </Context.Provider>
  )
}

export { PackageDialogProvider as Provider }
