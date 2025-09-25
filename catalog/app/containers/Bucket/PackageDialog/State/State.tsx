import invariant from 'invariant'
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

export { isPackageHandle } from './manifest'

interface PackageDst {
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

const Context = React.createContext<State | null>(null)

export function useContext(): State {
  const context = React.useContext(Context)
  invariant(context, 'useContext must be used within PackageDialogProvider')
  return context
}

export const use = useContext

export { Context }
