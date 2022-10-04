import * as R from 'ramda'
import * as React from 'react'

import type * as Model from 'model'

const Ctx = React.createContext<{
  append: (logicalKey: string, file: Model.S3File) => void
  clear: () => void
  entries: Record<string, Model.S3File>
  merge: (entries: Record<string, Model.S3File>) => void
} | null>(null)

interface ProviderProps {
  children: React.ReactNode
}

/** @deprecated Use Bookmarks.Provider and 'addToPackage' GroupName */
export function Provider({ children }: ProviderProps) {
  const [entries, setEntries] = React.useState({})
  const append = React.useCallback((logicalKey, s3File) => {
    setEntries(
      R.mergeLeft({
        [logicalKey]: s3File,
      }),
    )
  }, [])
  const clear = React.useCallback(() => setEntries({}), [])
  const merge = React.useCallback((files) => setEntries(R.mergeLeft(files)), [])

  const value = React.useMemo(
    () => ({ append, clear, entries, merge }),
    [append, clear, entries, merge],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

/** @deprecated Use useBookmarks and 'addToPackage' GroupName */
const useAddToPackage = () => React.useContext(Ctx)

/** @deprecated Use Bookmarks.use and 'addToPackage' GroupName */
export const use = useAddToPackage
