import * as R from 'ramda'
import * as React from 'react'

import { EMPTY_MAP, ListingSelection, SelectionItem, merge } from './utils'

interface State {
  inited: boolean
  clear: () => void
  isEmpty: boolean
  merge: (items: SelectionItem[], bucket: string, path: string, filter?: string) => void
  remove: (prefixUrl: string, index: number) => { isEmpty: boolean }
  selection: ListingSelection
  totalCount: number
}

const dummy = () => {
  new Error('Selection provider not initialized')
}

const Ctx = React.createContext<State>({
  inited: false,
  clear: dummy,
  isEmpty: true,
  merge: dummy,
  remove: () => {
    dummy()
    return { isEmpty: true }
  },
  selection: EMPTY_MAP,
  totalCount: 0,
})

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
    (ids: SelectionItem[], bucket: string, path: string, filter?: string) =>
      setSelection(merge(ids, bucket, path, filter)),
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
      inited: true,
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

export const useSelection = () => React.useContext(Ctx)

export const use = useSelection
