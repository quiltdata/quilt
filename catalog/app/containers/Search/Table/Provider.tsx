import * as React from 'react'

import type { Column } from './useColumns'

export type CollapsedFilters = Map<Column['filter'], boolean>

interface Context {
  focused: Column | null
  openFilter: (c: Column) => void
  closeFilter: () => void

  collapsed: CollapsedFilters
  toggleCollapsed: (f: Column['filter'], force?: boolean) => void
  // TODO: showColumn
  // TODO: hideColumn
}

const noop = () => {}

const initialContext: Context = {
  focused: null,
  collapsed: new Map(),

  openFilter: noop,
  closeFilter: noop,
  toggleCollapsed: noop,
}

const Ctx = React.createContext<Context>(initialContext)

export function Provider({ children }: { children: React.ReactNode }) {
  const [focused, setFocused] = React.useState<Column | null>(initialContext.focused)
  const openFilter = React.useCallback((c: Column) => setFocused(c), [])
  const closeFilter = React.useCallback(() => setFocused(null), [])

  const [collapsed, setCollapsed] = React.useState<CollapsedFilters>(
    initialContext.collapsed,
  )
  const toggleCollapsed = React.useCallback(
    (filter: Column['filter'], force?: boolean) => {
      setCollapsed((x) => {
        if (force === true) {
          return x.has(filter) ? x : new Map(x).set(filter, true)
        }

        if (force === false) {
          if (x.has(filter)) {
            const m = new Map(x)
            return m.delete(filter) ? m : x
          } else {
            return x
          }
        }

        if (x.has(filter)) {
          const m = new Map(x)
          return m.delete(filter) ? m : x
        } else {
          return new Map(x).set(filter, true)
        }
      })
    },
    [],
  )
  const value = React.useMemo(
    () => ({ focused, openFilter, closeFilter, collapsed, toggleCollapsed }),
    [focused, openFilter, closeFilter, collapsed, toggleCollapsed],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useContext = () => React.useContext(Ctx)
