import * as React from 'react'
import * as RF from 'react-final-form'

export interface SpyState {
  dirty: boolean
  modified?: Record<string, boolean>
}

interface SpyCallback {
  (state: SpyState): void
}

interface DirtyState {
  dirty: boolean
  onChange: SpyCallback
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

interface SpyProps {
  onChange: SpyCallback
}

export function Spy({ onChange }: SpyProps) {
  return <RF.FormSpy subscription={{ modified: true, dirty: true }} onChange={onChange} />
}
