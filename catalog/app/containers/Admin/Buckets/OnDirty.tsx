import * as React from 'react'

export interface SpyState {
  dirty: boolean
  modified?: Record<string, boolean>
}

interface DirtyState {
  dirty: boolean
  onChange: (state: SpyState) => void
}

const Ctx = React.createContext<DirtyState>({
  dirty: false,
  onChange: () => {
    throw new Error('Not initialized')
  },
})

interface ProviderProps {
  children: React.ReactNode
}

export function Provider({ children }: ProviderProps) {
  const [count, setCount] = React.useState(0)
  const onChange = React.useCallback(({ dirty, modified }: SpyState) => {
    if (!modified || Object.values(modified).every((v) => !v)) return
    setCount((c) => (dirty ? c + 1 : Math.max(c - 1, 0)))
  }, [])
  return <Ctx.Provider value={{ dirty: !!count, onChange }}>{children}</Ctx.Provider>
}

export const useOnDirty = () => React.useContext(Ctx)

export const use = useOnDirty
