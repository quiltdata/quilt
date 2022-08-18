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
  isBookmarked: (groupName: GroupName, file: S3HandleBase) => boolean
  isOpened: boolean
  remove: (groupName: GroupName, file: S3HandleBase) => void
  show: () => void
  toggle: (groupName: GroupName, file: S3HandleBase) => void
} | null>(null)

interface ProviderProps {
  children: React.ReactNode
}

const initialBookmarks = { main: { entries: {} } }

type StateUpdaterFunction = (input: BookmarksGroups) => BookmarksGroups

function createAppendUpdater(
  groupName: GroupName,
  s3File: S3HandleBase | S3HandleBase[],
): StateUpdaterFunction {
  if (Array.isArray(s3File)) {
    const entries = s3File.reduce(
      (memo, entry) => ({
        ...memo,
        [basename(entry.key)]: entry,
      }),
      {},
    )
    return R.over(R.lensPath([groupName, 'entries']), R.mergeLeft(entries))
  }
  return R.set(R.lensPath([groupName, 'entries', basename(s3File.key)]), s3File)
}

function createRemoveUpdater(
  groupName: GroupName,
  s3File: S3HandleBase,
): StateUpdaterFunction {
  return R.over(R.lensPath([groupName, 'entries']), R.dissoc(basename(s3File.key)))
}

function createClearUpdater(groupName: GroupName): StateUpdaterFunction {
  return R.assocPath([groupName, 'entries'], {})
}

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
      updateGroups(createAppendUpdater(groupName, s3File))
      if (!isOpened) setUpdates(true)
    },
    [isOpened, updateGroups],
  )
  const remove = React.useCallback(
    (groupName: GroupName, s3File: S3HandleBase) => {
      updateGroups(createRemoveUpdater(groupName, s3File))
      if (!isOpened) setUpdates(true)
    },
    [isOpened, updateGroups],
  )
  const clear = React.useCallback(
    (groupName: GroupName) => {
      updateGroups(createClearUpdater(groupName))
      setUpdates(false)
    },
    [updateGroups],
  )
  const isBookmarked = React.useCallback(
    (groupName: GroupName, s3File: S3HandleBase) =>
      R.hasPath([groupName, 'entries', basename(s3File.key)], groups),
    [groups],
  )
  const toggle = React.useCallback(
    (groupName: GroupName, s3File: S3HandleBase) => {
      const updater = isBookmarked(groupName, s3File)
        ? createRemoveUpdater
        : createAppendUpdater
      updateGroups(updater(groupName, s3File))
      if (!isOpened) setUpdates(true)
    },
    [isBookmarked, isOpened, updateGroups],
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
      isBookmarked,
      isOpened,
      remove,
      show: () => setOpened(true),
      toggle,
    }),
    [append, clear, groups, hasUpdates, hide, isBookmarked, isOpened, remove, toggle],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useBookmarks = () => React.useContext(Ctx)

export const use = useBookmarks
