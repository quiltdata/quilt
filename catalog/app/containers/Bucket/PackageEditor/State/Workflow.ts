import * as React from 'react'

import type { BucketConfig } from 'components/Form/Package/DestinationBucket'
import L from 'constants/loading'
import {
  Workflow as WorkflowStruct,
  WorkflowsConfig,
  notAvailable,
  notSelected,
} from 'utils/workflows'

import type { Manifest } from '../../PackageDialog/Manifest'
import useWorkflowsConfig from '../io/workflowsConfig'

import NOT_READY from './errorNotReady'

export interface WorkflowState {
  errors?: Error[]
  value: WorkflowStruct | null
  workflows: WorkflowStruct[] | typeof L | Error
}

export interface WorkflowContext {
  state: WorkflowState | typeof L
  getters: {
    disabled: () => boolean
    formData: () => string | null
  }
  actions: {
    onChange: (v: WorkflowStruct | null) => void
  }
}

function getFormData(state: WorkflowState | typeof L) {
  if (state === L || !state.value) {
    throw NOT_READY
  }
  const workflowSlug = state.value.slug
  switch (workflowSlug) {
    case notAvailable:
      return null
    case notSelected:
      return ''
    default:
      return workflowSlug
  }
}

function isDisabled(state: WorkflowState | typeof L) {
  return state === L || !!state.errors?.length
}

function useValidation(
  value: WorkflowStruct | null,
  config: WorkflowsConfig | Error | typeof L,
) {
  const [errors, setErrors] = React.useState<Error[] | undefined>()
  React.useEffect(() => {
    if (config === L || config instanceof Error) {
      setErrors([new Error('Workflows config is not available')])
      return
    }
    if (config.isWorkflowRequired && (value === null || value.slug === notSelected)) {
      setErrors([new Error('Workflow is required for this bucket')])
      return
    }
    setErrors(undefined)
  }, [config, value])
  return errors
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

  React.useEffect(() => setValue(null), [bucket])
  const config = useWorkflowsConfig(bucket?.name || null)

  React.useEffect(() => {
    if (value || manifest === L || config === L || config instanceof Error) return
    const defaultWorkflow = getDefaultWorkflow(config.workflows, manifest)
    if (defaultWorkflow) setValue(defaultWorkflow)
  }, [config, manifest, value])

  const errors = useValidation(value, config)

  const state = React.useMemo(() => {
    if (manifest === L || config === L) return L
    if (config instanceof Error) return { value: null, workflows: config }
    return {
      errors,
      value,
      workflows: config.workflows,
    }
  }, [errors, manifest, value, config])

  return React.useMemo(
    () => ({
      state,
      getters: {
        formData: () => getFormData(state),
        disabled: () => isDisabled(state),
      },
      actions: {
        onChange: setValue,
      },
    }),
    [state],
  )
}
