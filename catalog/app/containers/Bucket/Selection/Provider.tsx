import invariant from 'invariant'
import * as R from 'ramda'
import * as React from 'react'

import { EMPTY_MAP, ListingSelection, SelectionItem, merge } from './utils'

interface State {
  clear: () => void
  isEmpty: boolean
  merge: (items: SelectionItem[], bucket: string, path: string, filter?: string) => void
  remove: (prefixUrl: string, index: number) => { isEmpty: boolean }
  selection: ListingSelection
  totalCount: number
}

const Ctx = React.createContext<State | null>(null)

interface ProviderProps {
  children: React.ReactNode
}

export function Provider({ children }: ProviderProps) {
  const [selection, setSelection] = React.useState<ListingSelection>(EMPTY_MAP)
  const totalCount = React.useMemo(
    () => Object.values(selection).reduce((acc, ids) => acc + ids.length, 0),
    [selection],
  )
  const handleMerge = React.useCallback(
    (ids, bucket, path, filter) => setSelection(merge(ids, bucket, path, filter)),
    [],
  )
  const clear = React.useCallback(() => setSelection(EMPTY_MAP), [])
  const remove = React.useCallback(
    (prefixUrl: string, index: number) => {
      const newSelection = R.dissocPath<ListingSelection>([prefixUrl, index], selection)
      setSelection(newSelection)
      return {
        isEmpty: !Object.values(newSelection).some((ids) => !!ids.length),
      }
    },
    [selection],
  )
  const state = React.useMemo(
    () => ({
      clear,
      isEmpty: totalCount === 0,
      merge: handleMerge,
      remove,
      selection,
      totalCount,
    }),
    [clear, handleMerge, remove, selection, totalCount],
  )
  return <Ctx.Provider value={state}>{children}</Ctx.Provider>
}

export const useSelection = () => {
  const state = React.useContext(Ctx)
  invariant(state, 'Selection must be used within an Selection.Provider')
  return state
}

export const use = useSelection
