import type { ErrorObject } from 'ajv'
import * as React from 'react'

import { L } from 'components/Form/Package/types'
import type * as Types from 'utils/types'
import type { Schema } from 'utils/workflows'

import type { Manifest } from '../../PackageDialog/Manifest'
import { mkMetaValidator } from '../../PackageDialog/PackageDialog'

import type { WorkflowContext } from './Workflow'
// TODO
// import useMetadataSchema from '../io/metadataSchema'

export interface MetaState {
  errors?: (Error | ErrorObject)[]
  value?: Types.JsonRecord
  schema?: Schema
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
  const [value, setValue] = React.useState<Types.JsonRecord | undefined>(undefined)
  const [errors, setErrors] = React.useState<(Error | ErrorObject)[] | undefined>(
    undefined,
  )

  React.useEffect(() => {
    if (manifest === L) return
    setValue(manifest?.meta)
  }, [manifest])

  React.useEffect(() => {
    if (workflow.state === L) return
    const validationErrors = mkMetaValidator(workflow.state.value?.schema)(value || null)
    if (validationErrors && !Array.isArray(validationErrors)) {
      setErrors([validationErrors])
    } else {
      setErrors(validationErrors)
    }
  }, [value, workflow.state])

  const state = React.useMemo(() => {
    if (manifest === L || workflow.state === L) return L
    return {
      errors,
      value,
      schema: workflow.state.value?.schema,
    }
  }, [errors, manifest, workflow.state, value])

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
