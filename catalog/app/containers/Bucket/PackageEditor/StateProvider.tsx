import * as React from 'react'

import useContainerState, { State } from './state'
import useContainerActions, { Actions } from './actions'

interface ContextData {
  state: State
  actions: Actions
}

const Ctx = React.createContext<ContextData | null>(null)

export function useContext(): ContextData {
  const data = React.useContext(Ctx)
  if (!data?.state) throw new Error('Provide state')
  if (!data?.actions) throw new Error('Provide actions')
  return data
}

interface ProviderProps {
  bucket: string
  name: string
  hashOrTag: string
  hash?: string
  path: string
  mode?: string
  resolvedFrom?: string
  size?: number
children: React.ReactNode
}

export default function Provider({ bucket, children }: ProviderProps) {
  const [state, setState] = useContainerState(bucket)
  const actions = useContainerActions(state, setState)
  const value = React.useMemo(() => ({ state, actions }), [actions, state])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
