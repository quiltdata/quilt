import * as React from 'react'

import { FilesState, useFiles } from './files'
import { useFormStatus } from './form'
import { PackageSrc, useManifestRequest } from './manifest'
import { useMessage } from './message'
import { useName } from './name'
import { useMetadataSchema, useEntriesSchema } from './schema'
import { useWorkflowsConfig, useWorkflow } from './workflow'
import { useMeta } from './meta'
import { useParams } from './params'
import { useCopyHandler } from './copy'
import { useCreateHandler } from './create'
import { Context, State } from './State'

interface ProviderProps {
  children: React.ReactNode
  src?: PackageSrc
  dst: { bucket: string; name?: string }
  open?: boolean | FilesState['value']['added']
}

export function Provider({
  children,
  dst: initialDst,
  src: initialSrc,
  open: initialOpen = false,
}: ProviderProps) {
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

  const contextValue: State = {
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

  return <Context.Provider value={contextValue}>{children}</Context.Provider>
}
