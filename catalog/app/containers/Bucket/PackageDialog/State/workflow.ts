import * as React from 'react'

import * as AWS from 'utils/AWS'
import * as Request from 'utils/useRequest'
import * as workflows from 'utils/workflows'

import * as requests from '../../requests'

import { ManifestStatus } from './manifest'

export type WorkflowsConfigStatus =
  | { _tag: 'idle' }
  | { _tag: 'loading'; config: /* null config as fallback */ workflows.WorkflowsConfig }
  | {
      _tag: 'error'
      error: Error
      config: /* null config as fallback */ workflows.WorkflowsConfig
    }
  | { _tag: 'ready'; config: workflows.WorkflowsConfig }

export type WorkflowStatus =
  | { _tag: 'loading' }
  | { _tag: 'error'; error: Error }
  | { _tag: 'ok' }

interface PackageDst {
  bucket: string
  name?: string
}

export interface WorkflowState {
  onChange: (w: workflows.Workflow) => void
  status: WorkflowStatus
  value: workflows.Workflow | undefined
}

export function useWorkflowsConfig(
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
    return { _tag: 'loading', config: workflows.nullConfig }
  }
  if (result instanceof Error) {
    return { _tag: 'error', error: result, config: workflows.nullConfig }
  }

  return { _tag: 'ready', config: result }
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

export function useWorkflow(
  manifest: ManifestStatus,
  config: WorkflowsConfigStatus,
): WorkflowState {
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
