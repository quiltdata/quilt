import invariant from 'invariant'
import * as React from 'react'

import type { Column } from './useColumns'

export type HiddenColumns = Map<Column['filter'], boolean>

interface Context {
  filter: Column | null
  filterActions: {
    open: (c: Column) => void
    close: () => void
  }

  hiddenColumns: HiddenColumns
  columnsActions: {
    show: (fs: Column['filter'] | Column['filter'][]) => void
    hide: (fs: Column['filter'] | Column['filter'][]) => void
  }
}

const Ctx = React.createContext<Context | null>(null)

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
  const [filter, setFilter] = React.useState<Column | null>(null)
  const open = React.useCallback((c: Column) => setFilter(c), [])
  const close = React.useCallback(() => setFilter(null), [])

  const [hiddenColumns, setHiddenColumns] = React.useState<HiddenColumns>(new Map())
  const filterActions = React.useMemo(() => ({ open, close }), [open, close])
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
      filter,
      filterActions,
      hiddenColumns,
      columnsActions,
    }),
    [filter, filterActions, hiddenColumns, columnsActions],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useContext = () => {
  const ctx = React.useContext(Ctx)
  invariant(ctx, 'Context must be used within an Table.Provider')
  return ctx
}
