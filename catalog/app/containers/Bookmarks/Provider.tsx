import * as R from 'ramda'
import * as React from 'react'

import type * as Model from 'model'
import { handleToS3Url } from 'utils/s3paths'
import mkStorage from 'utils/storage'

const STORAGE_KEYS = {
  BOOKMARKS: 'BOOKMARKS',
}
const storage = mkStorage({
  [STORAGE_KEYS.BOOKMARKS]: STORAGE_KEYS.BOOKMARKS,
})

type GroupName = 'main'

interface BookmarksGroup {
  entries: Record<string, Model.S3.S3ObjectLocation>
}

type BookmarksGroups = Record<GroupName, BookmarksGroup>

const Ctx = React.createContext<{
  append: (
    groupName: GroupName,
    handle: Model.S3.S3ObjectLocation | Model.S3.S3ObjectLocation[],
  ) => void
  clear: (groupName: GroupName) => void
  groups: BookmarksGroups
  hasUpdates: boolean
  hide: () => void
  isBookmarked: (groupName: GroupName, handle: Model.S3.S3ObjectLocation) => boolean
  isOpened: boolean
  remove: (
    groupName: GroupName,
    handle: Model.S3.S3ObjectLocation | Model.S3.S3ObjectLocation[],
  ) => void
  show: () => void
  toggle: (groupName: GroupName, handle: Model.S3.S3ObjectLocation) => void
} | null>(null)

interface ProviderProps {
  children: React.ReactNode
}

const initialBookmarks = { main: { entries: {} } }

const keyResolver = (handle: Model.S3.S3ObjectLocation) => handleToS3Url(handle)

type StateUpdaterFunction = (input: BookmarksGroups) => BookmarksGroups

function createAppendUpdater(
  groupName: GroupName,
  handle: Model.S3.S3ObjectLocation | Model.S3.S3ObjectLocation[],
): StateUpdaterFunction {
  if (Array.isArray(handle)) {
    const entries = handle.reduce(
      (memo, entry) => ({
        ...memo,
        [keyResolver(entry)]: entry,
      }),
      {},
    )
    return R.over(R.lensPath([groupName, 'entries']), R.mergeLeft(entries))
  }
  return R.set(R.lensPath([groupName, 'entries', keyResolver(handle)]), handle)
}

function createRemoveUpdater(
  groupName: GroupName,
  handle: Model.S3.S3ObjectLocation | Model.S3.S3ObjectLocation[],
): StateUpdaterFunction {
  if (Array.isArray(handle)) {
    const keys = handle.map(keyResolver)
    return R.over(R.lensPath([groupName, 'entries']), R.omit(keys))
  }
  return R.over(R.lensPath([groupName, 'entries']), R.dissoc(keyResolver(handle)))
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
    (updater: StateUpdaterFunction) => {
      const newGroups = updater(groups)
      setGroups(newGroups)
      storage.set(STORAGE_KEYS.BOOKMARKS, newGroups)
      return newGroups
    },
    [groups],
  )
  const append = React.useCallback(
    (
      groupName: GroupName,
      handle: Model.S3.S3ObjectLocation | Model.S3.S3ObjectLocation[],
    ) => {
      updateGroups(createAppendUpdater(groupName, handle))
      if (!isOpened) setUpdates(true)
    },
    [isOpened, updateGroups],
  )
  const remove = React.useCallback(
    (
      groupName: GroupName,
      handle: Model.S3.S3ObjectLocation | Model.S3.S3ObjectLocation[],
    ) => {
      const newGroups = updateGroups(createRemoveUpdater(groupName, handle))
      const isEmpty = R.pipe(R.path([groupName, 'entries']), R.isEmpty)(newGroups)
      if (isEmpty) {
        setUpdates(false)
      } else if (!isOpened) {
        setUpdates(true)
      }
    },
    [groups, isOpened, updateGroups],
  )
  const clear = React.useCallback(
    (groupName: GroupName) => {
      updateGroups(createClearUpdater(groupName))
      setUpdates(false)
    },
    [updateGroups],
  )
  const isBookmarked = React.useCallback(
    (groupName: GroupName, handle: Model.S3.S3ObjectLocation) =>
      R.hasPath([groupName, 'entries', keyResolver(handle)], groups),
    [groups],
  )
  const toggle = React.useCallback(
    (groupName: GroupName, handle: Model.S3.S3ObjectLocation) =>
      isBookmarked(groupName, handle)
        ? remove(groupName, handle)
        : append(groupName, handle),
    [isBookmarked, remove, append],
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
