import * as React from 'react'

import type { BucketConfig } from 'components/Form/Package/DestinationBucket'
import { L } from 'components/Form/Package/types'
import { Workflow as WorkflowStruct, notSelected } from 'utils/workflows'

import type { Manifest } from '../../PackageDialog/Manifest'

import useWorkflowsConfig from '../io/workflowsConfig'

interface WorkflowState {
  errors?: Error[]
  value: WorkflowStruct | null
  workflows: WorkflowStruct[] | typeof L | Error
}

export interface WorkflowContext {
  state: WorkflowState | typeof L
  actions: {
    onChange: (v: WorkflowStruct | null) => void
  }
}

function useWorkflowsList(
  bucket: BucketConfig | null,
): WorkflowStruct[] | typeof L | Error {
  const config = useWorkflowsConfig(bucket?.name || null)
  return React.useMemo(() => {
    if (config === L || config instanceof Error) return config
    return config.workflows
  }, [config])
}

function getDefaultWorkflow(workflows: WorkflowStruct[], manifest?: Manifest) {
  return (
    workflows.find((w) => w.slug === manifest?.workflowId) ||
    workflows.find((w) => w.isDefault) ||
    workflows.find((w) => w.slug === notSelected) ||
    null
  )
}

export default function useWorkflow(
  bucket: BucketConfig | null,
  manifest?: Manifest | typeof L,
): WorkflowContext {
  const [value, setValue] = React.useState<WorkflowStruct | null>(null)

  const workflows = useWorkflowsList(bucket)

  const state = React.useMemo(() => {
    if (manifest === L || workflows === L) return L
    if (workflows instanceof Error) return { value: null, workflows }
    if (value) return { value, workflows }
    return {
      value: getDefaultWorkflow(workflows, manifest),
      workflows,
    }
  }, [manifest, value, workflows])

  return React.useMemo(
    () => ({
      state,
      actions: {
        onChange: setValue,
      },
    }),
    [state],
  )
}
