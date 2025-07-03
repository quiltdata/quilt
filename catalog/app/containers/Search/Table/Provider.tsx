import * as React from 'react'

import type { Column } from './useColumns'

export type HiddenColumns = Map<Column['filter'], boolean>

interface Context {
  focused: Column | null
  openFilter: (c: Column) => void
  closeFilter: () => void

  hiddenColumns: HiddenColumns
  columnsActions: {
    show: (fs: Column['filter'] | Column['filter'][]) => void
    hide: (fs: Column['filter'] | Column['filter'][]) => void
  }
}

const noop = () => {}

const initialContext: Context = {
  focused: null,
  openFilter: noop,
  closeFilter: noop,

  hiddenColumns: new Map(),
  columnsActions: {
    show: noop,
    hide: noop,
  },
}

const Ctx = React.createContext<Context>(initialContext)

function removeBool(x: HiddenColumns, f: Column['filter']) {
  const m = new Map(x)
  return m.delete(f) ? m : x
}

function removeBoolsList(x: HiddenColumns, fs: Column['filter'][]) {
  const m = new Map(x)
  for (const f of fs) {
    m.delete(f)
  }
  return m
}

function addBool(x: HiddenColumns, f: Column['filter']) {
  return new Map(x).set(f, true)
}

function addBoolsList(x: HiddenColumns, fs: Column['filter'][]) {
  return new Map(Array.from(x.entries()).concat(fs.map((f) => [f, true])))
}

export function Provider({ children }: { children: React.ReactNode }) {
  const [focused, setFocused] = React.useState<Column | null>(initialContext.focused)
  const openFilter = React.useCallback((c: Column) => setFocused(c), [])
  const closeFilter = React.useCallback(() => setFocused(null), [])

  const [hiddenColumns, setHiddenColumns] = React.useState<HiddenColumns>(
    initialContext.hiddenColumns,
  )
  const show = React.useCallback(
    (filters: Column['filter'] | Column['filter'][]) =>
      setHiddenColumns((x) =>
        Array.isArray(filters) ? removeBoolsList(x, filters) : removeBool(x, filters),
      ),
    [],
  )
  const hide = React.useCallback(
    (filters: Column['filter'] | Column['filter'][]) =>
      setHiddenColumns((x) =>
        Array.isArray(filters) ? addBoolsList(x, filters) : addBool(x, filters),
      ),
    [],
  )
  const columnsActions = React.useMemo(() => ({ show, hide }), [show, hide])
  const value = React.useMemo(
    () => ({
      focused,
      openFilter,
      closeFilter,
      hiddenColumns,
      columnsActions,
    }),
    [focused, openFilter, closeFilter, hiddenColumns, columnsActions],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useContext = () => React.useContext(Ctx)
