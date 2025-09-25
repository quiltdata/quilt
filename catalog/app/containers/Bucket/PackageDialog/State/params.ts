import * as React from 'react'

import * as Types from 'utils/types'
import * as workflows from 'utils/workflows'

import { getMetaValue } from '../../requests'

import { WorkflowState } from './workflow'
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

interface PackageDst {
  bucket: string
  name?: string
}

function workflowSelectionToWorkflow(workflow: workflows.Workflow): string | null {
  if (workflow.slug === workflows.notAvailable) return null
  if (workflow.slug === workflows.notSelected) return ''
  return workflow.slug
}

export function useParams(
  dst: PackageDst,
  workflow: WorkflowState,
  name: NameState,
  message: MessageState,
  metadataSchema: SchemaStatus,
  meta: MetaState,
): FormParams {
  return React.useMemo(() => {
    if (!workflow.value || workflow.status._tag === 'error') {
      return { _tag: 'invalid', error: new Error('Valid workflow required') }
    }
    if (!name.value || name.status._tag === 'error') {
      return { _tag: 'invalid', error: new Error('Valid name required') }
    }
    if (!message.value || message.status._tag === 'error') {
      return { _tag: 'invalid', error: new Error('Valid message required') }
    }

    if (metadataSchema._tag !== 'ready') {
      return {
        _tag: 'invalid',
        error: new Error('Metadata JSON Schema is not ready'),
      }
    }
    if (meta.status._tag === 'error') {
      return { _tag: 'invalid', error: new Error('Metadata must be valid') }
    }

    return {
      _tag: 'ok',
      params: {
        bucket: dst.bucket,
        message: message.value,
        name: name.value,
        userMeta: getMetaValue(meta.value, metadataSchema.schema) ?? null,
        workflow: workflowSelectionToWorkflow(workflow.value),
      },
    }
  }, [dst, workflow, name, message, metadataSchema, meta])
}
