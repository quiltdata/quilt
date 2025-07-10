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
    show: (fs: Column['filter']) => void
    hide: (fs: Column['filter']) => void
  }
}

const Ctx = React.createContext<Context | null>(null)

const removeBool = (f: Column['filter']) => (x: HiddenColumns) => {
  const m = new Map(x)
  return m.delete(f) ? m : x
}

const addBool = (f: Column['filter']) => (x: HiddenColumns) => new Map(x).set(f, true)

export function Provider({ children }: { children: React.ReactNode }) {
  const [filter, setFilter] = React.useState<Column | null>(null)
  const filterActions = React.useMemo(
    () => ({ open: (c: Column) => setFilter(c), close: () => setFilter(null) }),
    [],
  )

  const [hiddenColumns, setHiddenColumns] = React.useState<HiddenColumns>(new Map())
  const columnsActions = React.useMemo(
    () => ({
      show: (f: Column['filter']) => setHiddenColumns(removeBool(f)),
      hide: (f: Column['filter']) => setHiddenColumns(addBool(f)),
    }),
    [],
  )

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
