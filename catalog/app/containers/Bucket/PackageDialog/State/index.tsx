import invariant from 'invariant'
import * as React from 'react'

import type { UploadTotalProgress } from '../Uploads'

import { FilesState, useFiles } from './files'
import { FormStatus, useFormStatus } from './form'
import { PackageSrc, ManifestStatus, useManifestRequest } from './manifest'
import { MessageState, useMessage } from './message'
import { NameState, useName } from './name'
import { SchemaStatus, useMetadataSchema, useEntriesSchema } from './schema'
import {
  WorkflowsConfigStatus,
  WorkflowState,
  useWorkflowsConfig,
  useWorkflow,
} from './workflow'
import { MetaState, useMeta } from './meta'
import { FormParams, useParams } from './params'
import { CopyHandler, useCopyHandler } from './copy'
import { CreateHandler, useCreateHandler, ReadmeHandler } from './create'

export { isPackageHandle } from './manifest'

interface PackageDst {
  bucket: string
  name?: string
}

interface PackageDialogState {
  message: MessageState
  meta: MetaState
  name: NameState
  workflow: WorkflowState

  src?: PackageSrc
  setSrc: (src: PackageSrc) => void
  dst: PackageDst
  setDst: React.Dispatch<React.SetStateAction<PackageDst>>

  reset: () => void
  open: boolean | FilesState['value']['added']
  setOpen: (o: boolean | FilesState['value']['added']) => void

  manifest: ManifestStatus
  workflowsConfig: WorkflowsConfigStatus
  metadataSchema: SchemaStatus

  params: FormParams
  formStatus: FormStatus

  // Create
  // ---
  entriesSchema: SchemaStatus

  files: FilesState

  create: CreateHandler
  progress: UploadTotalProgress
  onAddReadme: ReadmeHandler

  // Copy
  // ---

  copy: CopyHandler
}

const Context = React.createContext<PackageDialogState | null>(null)

export function useContext(): PackageDialogState {
  const context = React.useContext(Context)
  invariant(context, 'useContext must be used within PackageDialogProvider')
  return context
}

export const use = useContext

interface PackageDialogProviderProps {
  children: React.ReactNode
  src?: PackageSrc
  dst: PackageDst
  open?: boolean | FilesState['value']['added']
}

export function PackageDialogProvider({
  children,
  dst: initialDst,
  src: initialSrc,
  open: initialOpen = false,
}: PackageDialogProviderProps) {
  const [open, setOpen] = React.useState(initialOpen)

  const { formStatus, setFormStatus } = useFormStatus(initialOpen)

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

  const metadataSchema = useMetadataSchema(workflow.value)
  const entriesSchema = useEntriesSchema(workflow.value)

  const name = useName(formStatus, dst, setDst, src, workflow.value)
  const message = useMessage(formStatus)
  const meta = useMeta(formStatus, metadataSchema, manifest)
  const files = useFiles(formStatus, entriesSchema, manifest, open)

  const params = useParams(dst, workflow, name, message, metadataSchema, meta)

  const { create, progress, onAddReadme } = useCreateHandler(params, files, setFormStatus)
  const copy = useCopyHandler(params, setFormStatus)

  return (
    <Context.Provider
      value={{
        files,
        message,
        meta,
        name,
        workflow,

        reset,

        src,
        setSrc,

        dst,
        setDst,

        open,
        setOpen,

        manifest,
        workflowsConfig,
        metadataSchema,
        entriesSchema,

        create,
        copy,
        formStatus,
        params,
        progress,

        onAddReadme,
      }}
    >
      {children}
    </Context.Provider>
  )
}

export { PackageDialogProvider as Provider }
