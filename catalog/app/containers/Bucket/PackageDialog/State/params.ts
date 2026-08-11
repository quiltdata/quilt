import * as React from 'react'

import * as Types from 'utils/types'
import * as workflows from 'utils/workflows'

import * as ERRORS from '../../errors'
import { getMetaValue } from '../../requests'

import { WorkflowState } from './workflow'
import { ManifestStatus } from './manifest'
import { NameState } from './name'
import { MessageState } from './message'
import { MetaState } from './meta'
import { SchemaStatus } from './schema'

export type FormParams =
  | { _tag: 'invalid'; error: Error }
  | {
      _tag: 'ok'
      params: {
        bucket: string

        message: string
        name: string
        userMeta: Types.JsonRecord | null
        workflow: string | null
      }
    }

export const Invalid = (error: Error) => ({ _tag: 'invalid' as const, error })
export const Ok = (params: {
  bucket: string
  message: string
  name: string
  userMeta: Types.JsonRecord | null
  workflow: string | null
}) => ({ _tag: 'ok' as const, params })

interface PackageDst {
  bucket: string
  name?: string
}

function workflowSelectionToWorkflow(workflow: workflows.Workflow): string | null {
  if (workflow.slug === workflows.notAvailable) return null
  if (workflow.slug === workflows.notSelected) return ''
  return workflow.slug
}

export interface FormInputs {
  dst: PackageDst
  manifest: ManifestStatus
  message: MessageState
  meta: MetaState
  metadataSchema: SchemaStatus
  name: NameState
  workflow: WorkflowState
}

export function useParams({
  dst,
  manifest,
  message,
  meta,
  metadataSchema,
  name,
  workflow,
}: FormInputs): FormParams {
  return React.useMemo(() => {
    // Entries are sent as a complete replacement list, and an unloaded manifest yields
    // no existing entries, no metadata and no workflow — so pushing to a destination
    // that already exists would silently drop whatever failed to load. Only a name
    // confirmed absent is safe, which is why the existence check behind it must fail
    // closed (see useNameExistence).
    //
    // This comes first because the same unloaded manifest also blocks the workflow
    // prefill: reported later, a missing workflow would mask it, and the dialog would
    // describe an existing destination as safe to push over.
    if (manifest._tag !== 'ready' && name.status._tag !== 'new') {
      return Invalid(new ERRORS.SourceManifestNotLoaded())
    }
    if (!workflow.value || workflow.status._tag === 'error') {
      return Invalid(new Error('Valid workflow required'))
    }
    if (!name.value || name.status._tag === 'error') {
      return Invalid(new Error('Valid name required'))
    }
    if (!message.value || message.status._tag === 'error') {
      return Invalid(new Error('Valid message required'))
    }

    if (metadataSchema._tag !== 'ready') {
      return Invalid(new Error('Metadata JSON Schema is not ready'))
    }
    if (meta.status._tag === 'error') {
      return Invalid(new Error('Metadata must be valid'))
    }

    return Ok({
      bucket: dst.bucket,
      message: message.value,
      name: name.value,
      userMeta: getMetaValue(meta.value, metadataSchema.schema) ?? null,
      workflow: workflowSelectionToWorkflow(workflow.value),
    })
  }, [dst, workflow, name, message, metadataSchema, meta, manifest])
}
