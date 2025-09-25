import * as React from 'react'

import type { FormStatus } from '../State/form'
import type { SchemaStatus } from '../State/schema'
import type { WorkflowState, WorkflowsConfigStatus } from '../State/workflow'
import { WorkflowsInputSkeleton } from '../Skeleton'
import SelectWorkflow from '../SelectWorkflow'

interface InputWorkflowProps {
  formStatus: FormStatus
  schema: SchemaStatus
  state: WorkflowState
  config: WorkflowsConfigStatus
}

export default function InputWorkflow({
  formStatus,
  schema,
  state: { status, value, onChange },
  config,
}: InputWorkflowProps) {
  const error = React.useMemo(() => {
    if (config._tag === 'error') return config.error.message
    if (status._tag === 'error') return status.error.message
    return undefined
  }, [status, config])
  if (config._tag === 'idle') return null
  if (config._tag === 'loading') return <WorkflowsInputSkeleton />
  return (
    <SelectWorkflow
      disabled={schema._tag === 'loading' || formStatus._tag === 'submitting'}
      error={error}
      items={config.config.workflows}
      onChange={onChange}
      value={value}
    />
  )
}
