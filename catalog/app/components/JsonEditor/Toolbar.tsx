import * as React from 'react'

import * as JSONPointer from 'utils/JSONPointer'
import type { JsonRecord } from 'utils/types'

export interface ToolbarProps {
  columnPath: JSONPointer.Path
  onChange: (func: (v: JsonRecord) => JsonRecord) => void
}

interface ToolbarOptions {
  Toolbar: React.FC<ToolbarProps>
}

const Ctx = React.createContext<ToolbarOptions | null>(null)

interface ProviderProps {
  children: React.ReactNode
  value: ToolbarOptions
}

export function Provider({ children, value }: ProviderProps) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useToolbar = () => React.useContext(Ctx)
export const use = useToolbar
