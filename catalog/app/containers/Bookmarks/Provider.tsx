import { basename } from 'path'

import * as R from 'ramda'
import * as React from 'react'

// import type * as Model from 'model'
import type { S3HandleBase } from 'utils/s3paths'

interface BookmarksGroup {
  entries: Record<string, S3HandleBase>
}

type BookmarksGroups = Record<string, BookmarksGroup>

const Ctx = React.createContext<{
  append: (groupName: string, file: S3HandleBase) => void
  clear: (groupName: string) => void
  groups: BookmarksGroups
  hide: () => void
  isOpened: boolean
  remove: (groupName: string, file: S3HandleBase) => void
  show: () => void
} | null>(null)

interface ProviderProps {
  children: React.ReactNode
}

export function Provider({ children }: ProviderProps) {
  const [isOpened, setOpened] = React.useState(false)
  const [groups, setGroups] = React.useState({})
  const append = React.useCallback((groupName: string, s3File: S3HandleBase) => {
    setGroups(R.set(R.lensPath([groupName, 'entries', basename(s3File.key)]), s3File))
  }, [])
  const remove = React.useCallback(
    (groupName: string, s3File: Pick<S3HandleBase, 'key'>) => {
      setGroups(
        R.over(R.lensPath([groupName, 'entries']), R.dissoc(basename(s3File.key))),
      )
    },
    [],
  )
  const clear = React.useCallback(
    (groupName: string) => setGroups(R.assocPath([groupName, 'entries'], {})),
    [],
  )

  const value = React.useMemo(
    () => ({
      append,
      clear,
      groups,
      hide: () => setOpened(false),
      isOpened,
      remove,
      show: () => setOpened(true),
    }),
    [append, clear, remove, groups, isOpened],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useBookmarks = () => React.useContext(Ctx)

export const use = useBookmarks
