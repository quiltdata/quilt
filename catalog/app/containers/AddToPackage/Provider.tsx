import { basename } from 'path'

import * as R from 'ramda'
import * as React from 'react'

import type * as Model from 'model'

const dummy = () => {
  throw new Error('Please initialize the Provider')
}

const Ctx = React.createContext<{
  append: (file: Model.S3File) => void
  clear: () => void
  entries: Record<string, Model.S3File>
}>({
  append: dummy,
  clear: dummy,
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
  const clear = React.useCallback(() => setEntries({}), [])

  const value = React.useMemo(
    () => ({ append, clear, entries }),
    [append, clear, entries],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

const useAddToPackage = () => React.useContext(Ctx)

export const use = useAddToPackage
