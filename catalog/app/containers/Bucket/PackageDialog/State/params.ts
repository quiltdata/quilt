import * as React from 'react'

import * as Types from 'utils/types'
import * as workflows from 'utils/workflows'

import * as ERRORS from '../../errors'
import { getMetaValue } from '../../requests'

import { WorkflowState } from './workflow'
import { ManifestStatus, PackageSrc } from './manifest'
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
  src?: PackageSrc
  workflow: WorkflowState
}

export function useParams({
  dst,
  manifest,
  message,
  meta,
  metadataSchema,
  name,
  src,
  workflow,
}: FormInputs): FormParams {
  return React.useMemo(() => {
    // Entries are sent as a complete replacement list, so publishing while the manifest
    // is unloaded would drop everything it could not report. Only a name confirmed
    // absent is safe, so the existence check behind it fails closed (see
    // useNameExistence). Checked first because the same failure also blocks the workflow
    // prefill, and reporting that instead would call an existing destination safe.
    if (manifest._tag !== 'ready' && name.status._tag !== 'new') {
      return Invalid(new ERRORS.SourceManifestNotLoaded())
    }
    // The loaded manifest describes `src`, so any `dst` neither confirmed absent ('new')
    // nor confirmed to be `src` ('new-revision') would get this one's entries as its
    // complete replacement list. An unusable name is left to the gate below to word.
    if (
      src &&
      name.status._tag !== 'new' &&
      name.status._tag !== 'new-revision' &&
      name.status._tag !== 'error'
    ) {
      return Invalid(new ERRORS.DestinationManifestMismatch())
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
  }, [dst, src, workflow, name, message, metadataSchema, meta, manifest])
}
