import { basename } from 'path'

import * as R from 'ramda'
import * as React from 'react'

import type { S3HandleBase } from 'utils/s3paths'
import mkStorage from 'utils/storage'

const STORAGE_KEYS = {
  BOOKMARKS: 'BOOKMARKS',
}
const storage = mkStorage({
  [STORAGE_KEYS.BOOKMARKS]: STORAGE_KEYS.BOOKMARKS,
})

type GroupName = 'main'

interface BookmarksGroup {
  entries: Record<string, S3HandleBase>
}

type BookmarksGroups = Record<GroupName, BookmarksGroup>

const Ctx = React.createContext<{
  append: (groupName: GroupName, file: S3HandleBase | S3HandleBase[]) => void
  clear: (groupName: GroupName) => void
  groups: BookmarksGroups
  hasUpdates: boolean
  hide: () => void
  isOpened: boolean
  remove: (groupName: GroupName, file: S3HandleBase) => void
  show: () => void
} | null>(null)

interface ProviderProps {
  children: React.ReactNode
}

const initialBookmarks = { main: { entries: {} } }

export function Provider({ children }: ProviderProps) {
  const [hasUpdates, setUpdates] = React.useState(false)
  const [isOpened, setOpened] = React.useState(false)
  const [groups, setGroups] = React.useState(() => {
    try {
      return storage.get(STORAGE_KEYS.BOOKMARKS) || initialBookmarks
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e)
      return initialBookmarks
    }
  })
  const updateGroups = React.useCallback(
    (updater) => {
      const newGroups = updater(groups)
      setGroups(newGroups)
      storage.set(STORAGE_KEYS.BOOKMARKS, newGroups)
    },
    [groups],
  )
  const append = React.useCallback(
    (groupName: GroupName, s3File: S3HandleBase | S3HandleBase[]) => {
      if (Array.isArray(s3File)) {
        const entries = s3File.reduce(
          (memo, entry) => ({
            ...memo,
            [basename(entry.key)]: entry,
          }),
          {},
        )
        updateGroups(R.over(R.lensPath([groupName, 'entries']), R.mergeLeft(entries)))
      } else {
        updateGroups(
          R.set(R.lensPath([groupName, 'entries', basename(s3File.key)]), s3File),
        )
      }
      if (!isOpened) setUpdates(true)
    },
    [isOpened, updateGroups],
  )
  const remove = React.useCallback(
    (groupName: GroupName, s3File: Pick<S3HandleBase, 'key'>) => {
      updateGroups(
        R.over(R.lensPath([groupName, 'entries']), R.dissoc(basename(s3File.key))),
      )
      if (!isOpened) setUpdates(true)
    },
    [isOpened, updateGroups],
  )
  const clear = React.useCallback(
    (groupName: GroupName) => {
      updateGroups(R.assocPath([groupName, 'entries'], {}))
      if (!isOpened) setUpdates(true)
    },
    [isOpened, updateGroups],
  )
  const hide = React.useCallback(() => {
    setOpened(false)
    setUpdates(false)
  }, [])

  const value = React.useMemo(
    () => ({
      append,
      clear,
      groups,
      hasUpdates,
      hide,
      isOpened,
      remove,
      show: () => setOpened(true),
    }),
    [append, clear, groups, hasUpdates, hide, isOpened, remove],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useBookmarks = () => React.useContext(Ctx)

export const use = useBookmarks
