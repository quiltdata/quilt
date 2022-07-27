import { basename } from 'path'

import * as R from 'ramda'
import * as React from 'react'

import type * as Model from 'model'

const Ctx = React.createContext<{
  append: (file: Model.S3File) => void
  entries: Record<string, Model.S3File>
}>({
  append: () => {},
  entries: {},
})

interface ProviderProps {
  children: React.ReactNode
}

export function Provider({ children }: ProviderProps) {
  const [entries, setEntries] = React.useState({})
  const append = React.useCallback((s3File) => {
    setEntries(
      R.mergeLeft({
        [basename(s3File.key)]: s3File,
      }),
    )
  }, [])
  return <Ctx.Provider value={{ entries, append }}>{children}</Ctx.Provider>
}

export const useShopping = () => React.useContext(Ctx)

export const use = useShopping
