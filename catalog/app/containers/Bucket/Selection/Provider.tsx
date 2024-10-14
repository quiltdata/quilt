import invariant from 'invariant'
import * as React from 'react'

import { EMPTY_MAP, ListingSelection } from './utils'

// TODO: Go from down to top once again and check selection props

interface State {
  hasSelection: boolean
  selection: ListingSelection
  // TODO: Find out what to do with merge
  setSelection: React.Dispatch<React.SetStateAction<ListingSelection>>
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
  const state = React.useMemo(
    () => ({
      hasSelection: totalCount > 0,
      selection,
      setSelection,
      totalCount,
    }),
    [selection, setSelection, totalCount],
  )
  return <Ctx.Provider value={state}>{children}</Ctx.Provider>
}

export const useSelection = () => {
  const state = React.useContext(Ctx)
  invariant(state, 'Selection must be used within an Selection.Provider')
  return state
}

export const use = useSelection
