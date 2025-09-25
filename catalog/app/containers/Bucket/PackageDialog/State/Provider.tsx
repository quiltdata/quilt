import invariant from 'invariant'
import * as React from 'react'

import type { FilesState } from './files'
import type { PackageSrc } from './manifest'
import { State, useState } from './State'

interface ProviderProps {
  children: React.ReactNode
  src?: PackageSrc
  dst: { bucket: string; name?: string }
  open?: boolean | FilesState['value']['added']
}

export function Provider({ children, dst, src, open = false }: ProviderProps) {
  const contextValue = useState(dst, src, open)
  return <Context.Provider value={contextValue}>{children}</Context.Provider>
}

export const Context = React.createContext<State | null>(null)

export function useContext(): State {
  const context = React.useContext(Context)
  invariant(context, 'useContext must be used within PackageDialogProvider')
  return context
}
