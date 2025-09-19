import invariant from 'invariant'
import * as React from 'react'

import * as AWS from 'utils/AWS'
import * as GQL from 'utils/GraphQL'
import { JsonSchema } from 'utils/JSONSchema'
import { JsonRecord } from 'utils/types'
import * as Request from 'utils/useRequest'
import * as workflows from 'utils/workflows'

import * as requests from '../requests'

import { Manifest, useManifest } from './Manifest'
import * as FI from './FilesInput'

import PACKAGE_EXISTS_QUERY from './gql/PackageExists.generated'

// FIXME: re-use already added files when reload manifest
// FIXME: handle both validations on file input
// FIXME: use workflow' package name template to fill `initialDst`

type NameStatus =
  | { _tag: 'idle' }
  | { _tag: 'loading' }
  | { _tag: 'exists' }
  | { _tag: 'able-to-reuse'; dst: Required<PackageDst> }
  | { _tag: 'invalid' }
  | { _tag: 'new' }

type ManifestStatus =
  | { _tag: 'idle' }
  | { _tag: 'loading' }
  | { _tag: 'error'; error: Error }
  | { _tag: 'ready'; manifest: Manifest | undefined }

type WorkflowsConfigStatus =
  | { _tag: 'idle' }
  | { _tag: 'loading'; config: /*empty config as fallback*/ workflows.WorkflowsConfig }
  | {
      _tag: 'error'
      error: Error
      config: /*empty config as fallback*/ workflows.WorkflowsConfig
    }
  | { _tag: 'ready'; config: workflows.WorkflowsConfig }

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

interface PackageDialogState {
  values: {
    files: {
      onChange: (f: Partial<FI.FilesState>) => void
      value: FI.FilesState
    }
    message: {
      onChange: (m: string) => void
      value: string | undefined
    }
    meta: {
      onChange: (m: JsonRecord) => void
      value: JsonRecord | undefined
    }
    name: {
      onChange: (n: string) => void
      status: NameStatus
      value: string | undefined
    }
    workflow: {
      onChange: (w: workflows.Workflow) => void
      // status: WorkflowStatus
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
}

const Context = React.createContext<PackageDialogState | null>(null)

export function useContext(): PackageDialogState {
  const context = React.useContext(Context)
  invariant(context, 'useContext must be used within PackageDialogProvider')
  return context
}

export const use = useContext

function useNameValidator(dst: PackageDst, src?: PackageSrc): NameStatus {
  const pause =
    !dst.bucket || !dst.name || (dst.bucket === src?.bucket && dst.name === src.name)
  const packageExistsQuery = GQL.useQuery(
    PACKAGE_EXISTS_QUERY,
    dst as Required<PackageDst>,
    { pause },
  )
  return React.useMemo(() => {
    if (pause) return { _tag: 'idle' }
    if (dst.bucket === src?.bucket && dst.name === src.name) return { _tag: 'exists' }
    return GQL.fold(packageExistsQuery, {
      data: ({ package: r }) => {
        if (!r) return { _tag: 'new' }
        switch (r.__typename) {
          default:
            return { _tag: 'able-to-reuse', dst: { bucket: dst.bucket, name: r.name } }
        }
      },
      fetching: () => ({ _tag: 'loading' }),
      error: () => ({ _tag: 'invalid' }),
    })
  }, [dst, packageExistsQuery, pause, src])
}

function useName(onChange: (n: string) => void, dst: PackageDst, src?: PackageSrc) {
  const status = useNameValidator(dst, src)
  return React.useMemo(
    () => ({ onChange, status, value: dst.name }),
    [dst.name, status, onChange],
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
    if (pause) return { _tag: 'idle' }
    return data.case({
      Ok: (manifest: Manifest | undefined) => ({ _tag: 'ready', manifest }),
      Pending: () => ({ _tag: 'loading' }),
      Init: () => ({ _tag: 'idle' }),
      Err: (error: Error) => ({ _tag: 'error', error }),
    })
  }, [pause, data])
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
  const status = manifest._tag
  return React.useMemo(() => ({ onChange: setWorkflow, status, value }), [status, value])
}

function useMessage() {
  const [message, setMessage] = React.useState<string>()
  return React.useMemo(() => ({ value: message, onChange: setMessage }), [message])
}

function getMetaFallback(manifest: ManifestStatus) {
  if (manifest._tag !== 'ready') return undefined
  return manifest.manifest?.meta
}

function useMeta(manifest: ManifestStatus) {
  const [meta, setMeta] = React.useState<JsonRecord>()
  const value = React.useMemo(() => meta || getMetaFallback(manifest), [manifest, meta])
  return React.useMemo(() => ({ value, onChange: setMeta }), [value])
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

  const [src, setSrc] = React.useState(initialSrc)
  const [dst, setDst] = React.useState(initialDst)

  const reset = React.useCallback(() => {
    setSrc(initialSrc)
    setDst(initialDst)
  }, [initialSrc, initialDst])

  // Sync with external source updates
  React.useEffect(() => reset(), [reset])

  const manifest = useManifestRequest(!!open, src)
  const workflowsConfig = useWorkflowsConfig(!!open, dst)

  const onName = React.useCallback((name: string) => setDst((d) => ({ ...d, name })), [])
  const name = useName(onName, dst, src)
  const workflow = useWorkflow(manifest, workflowsConfig)
  const message = useMessage()
  const meta = useMeta(manifest)
  const files = useFiles(manifest, open)

  const schema = useWorkflowSchema(workflow.value)

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
      }}
    >
      {children}
    </Context.Provider>
  )
}

export { PackageDialogProvider as Provider }
