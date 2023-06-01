import type { ErrorObject } from 'ajv'
import * as React from 'react'

import { L } from 'components/Form/Package/types'
import type * as Types from 'utils/types'
import type { Schema } from 'utils/workflows'

import type { Manifest } from '../../PackageDialog/Manifest'
import { mkMetaValidator } from '../../PackageDialog/PackageDialog'

import useWorkflowsConfig from '../io/metadataSchema'

import type { WorkflowContext } from './Workflow'

export interface MetaState {
  errors?: (Error | ErrorObject)[]
  value?: Types.JsonRecord
  schema?: Schema | typeof L
}

export interface MetaContext {
  state: MetaState | typeof L
  actions: {
    onChange: (v: Types.JsonRecord) => void
  }
}

export default function useMeta(
  workflow: WorkflowContext,
  manifest?: Manifest | typeof L,
): MetaContext {
  const [value, setValue] = React.useState<Types.JsonRecord | typeof L | undefined>(
    undefined,
  )
  const [errors, setErrors] = React.useState<(Error | ErrorObject)[] | undefined>(
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

  React.useEffect(() => {
    if (schema === L || value === L) return
    const validationErrors = mkMetaValidator(schema)(value || null)
    if (validationErrors && !Array.isArray(validationErrors)) {
      setErrors([validationErrors])
    } else {
      setErrors(validationErrors)
    }
  }, [value, schema, workflow.state])

  const state = React.useMemo(() => {
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
      actions: {
        onChange: setValue,
      },
    }),
    [state],
  )
}
