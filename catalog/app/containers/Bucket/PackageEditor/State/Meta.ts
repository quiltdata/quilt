import type { ErrorObject } from 'ajv'
import * as React from 'react'

import { L } from 'components/Form/Package/types'
import type * as Types from 'utils/types'
import type { Schema } from 'utils/workflows'

import type { Manifest } from '../../PackageDialog/Manifest'
import { mkMetaValidator } from '../../PackageDialog/PackageDialog'

import useWorkflowsConfig from '../io/metadataSchema'

import type { WorkflowContext } from './Workflow'
import NOT_READY from './errorNotReady'

export interface MetaState {
  errors?: (Error | ErrorObject)[]
  value?: Types.JsonRecord | typeof L
  schema?: Schema | typeof L
}

export interface MetaContext {
  state: MetaState | typeof L
  getters: {
    disabled: () => boolean
    formData: () => Types.JsonRecord | null
  }
  actions: {
    onChange: (v: Types.JsonRecord) => void
  }
}

function getFormData(state: MetaState | typeof L) {
  if (state === L || state.value === L) {
    throw NOT_READY
  }
  return state.value || null
}

function isDisabled(state: MetaState | typeof L) {
  return state === L || !!state.errors?.length
}

function useValidation(value?: Types.JsonRecord | typeof L, schema?: Schema | typeof L) {
  const [errors, setErrors] = React.useState<(Error | ErrorObject)[] | undefined>(
    undefined,
  )
  React.useEffect(() => {
    if (schema === L || value === L) return
    const validationErrors = mkMetaValidator(schema)(value || null)
    if (validationErrors && !Array.isArray(validationErrors)) {
      setErrors([validationErrors])
    } else {
      setErrors(validationErrors)
    }
  }, [value, schema])
  return errors
}

export default function useMeta(
  workflow: WorkflowContext,
  manifest?: Manifest | typeof L,
): MetaContext {
  const [value, setValue] = React.useState<Types.JsonRecord | typeof L | undefined>(
    undefined,
  )

  React.useEffect(() => {
    if (manifest === L) {
      setValue(L)
    } else {
      setValue(manifest?.meta)
    }
  }, [manifest])

  const schemaUrl = workflow.state === L ? '' : workflow.state.value?.schema?.url
  const schema = useWorkflowsConfig(schemaUrl)

  const errors = useValidation(value, schema)

  const state: MetaState | typeof L = React.useMemo(() => {
    if (value === L || schema === L) return L
    return {
      errors,
      schema,
      value,
    }
  }, [errors, schema, value])

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
