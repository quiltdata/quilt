import * as React from 'react'

import type { UploadTotalProgress } from '../Uploads'

import type { FilesState } from './files'
import type { FormStatus } from './form'
import type { PackageSrc, ManifestStatus } from './manifest'
import type { MessageState } from './message'
import type { NameState } from './name'
import type { SchemaStatus } from './schema'
import type { WorkflowsConfigStatus, WorkflowState } from './workflow'
import type { MetaState } from './meta'
import type { FormParams } from './params'
import type { CopyHandler } from './copy'
import type { CreateHandler, ReadmeHandler } from './create'

import { useFiles } from './files'
import { useFormStatus } from './form'
import { useManifestRequest } from './manifest'
import { useMessage } from './message'
import { useName } from './name'
import { useMetadataSchema, useEntriesSchema } from './schema'
import { useWorkflowsConfig, useWorkflow } from './workflow'
import { useMeta } from './meta'
import { useParams } from './params'
import { useCopyHandler } from './copy'
import { useCreateHandler } from './create'

export interface PackageDst {
  bucket: string
  name?: string
}

export interface State {
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

  entriesSchema: SchemaStatus

  files: FilesState

  create: CreateHandler
  progress: UploadTotalProgress
  onAddReadme: ReadmeHandler

  // Copy

  copy: CopyHandler
}

// TODO: split states for Create.tsx and Copy.tsx
//       so, for example, Copy.tsx didn't include `files` and `entriesSchema` fetching

/**
 * Main state hook for PackageDialog forms.
 *
 * Orchestrates all form state including validation, file management,
 * schema loading, and API handlers for create/copy operations.
 */
export function useState(
  initialDst: PackageDst,
  initialSrc?: PackageSrc,
  initialOpen: boolean | FilesState['value']['added'] = false,
): State {
  const [open, setOpen] = React.useState(initialOpen)
  React.useEffect(() => {
    setOpen(initialOpen)
  }, [initialOpen])

  const { formStatus, setFormStatus } = useFormStatus(open)

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

  return {
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
  }
}
