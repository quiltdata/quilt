import * as React from 'react'

import { L } from 'components/Form/Package/types'
import type * as Types from 'utils/types'
import type { Schema } from 'utils/workflows'

import type { Manifest } from '../../PackageDialog/Manifest'

import type { WorkflowContext } from './Workflow'

interface MetaState {
  value?: Types.JsonRecord
  schema?: Schema
}

export interface MetaContext {
  state: MetaState | typeof L
}

export default function useMeta(
  workflow: WorkflowContext,
  manifest?: Manifest | typeof L,
): MetaContext {
  const state = React.useMemo(() => {
    if (manifest === L || workflow.state === L) return L
    return {
      value: manifest?.meta,
      schema: workflow.state.value?.schema,
    }
  }, [workflow.state, manifest])
  return React.useMemo(
    () => ({
      state,
    }),
    [state],
  )
}
