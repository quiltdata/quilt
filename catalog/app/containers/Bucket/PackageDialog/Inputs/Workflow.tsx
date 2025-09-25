import * as React from 'react'

import * as State from '../State'
import { WorkflowsInputSkeleton } from '../Skeleton'
import SelectWorkflow from '../SelectWorkflow'

export default function InputWorkflow() {
  const {
    formStatus,
    metadataSchema: schema,
    workflow: { status, value, onChange },
    workflowsConfig,
  } = State.use()
  const error = React.useMemo(() => {
    if (workflowsConfig._tag === 'error') return workflowsConfig.error.message
    if (status._tag === 'error') return status.error.message
    return undefined
  }, [status, workflowsConfig])
  if (workflowsConfig._tag === 'idle') return null
  if (workflowsConfig._tag === 'loading') return <WorkflowsInputSkeleton />
  return (
    <SelectWorkflow
      disabled={schema._tag === 'loading' || formStatus._tag === 'submitting'}
      error={error}
      items={workflowsConfig.config.workflows}
      onChange={onChange}
      value={value}
    />
  )
}
