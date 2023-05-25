import * as React from 'react'

import { L } from 'components/Form/Package/types'

import type { Src } from './Source'
import type { WorkflowContext } from './Workflow'

interface NameState {
  errors?: Error[] | typeof L
  value: string
}

export interface NameContext {
  state: NameState | typeof L
  actions: {
    onChange: (v: string) => void
  }
}

export default function useName(src: Src, workflow: WorkflowContext): NameContext {
  const [value, setValue] = React.useState(src.packageHandle?.name || '')
  const state = React.useMemo(
    () => (workflow.state === L ? L : { value }),
    [value, workflow.state],
  )
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
