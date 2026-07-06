import invariant from 'invariant'
import * as React from 'react'

import * as Bookmarks from 'containers/Bookmarks'
import * as Selection from 'containers/Bucket/Selection'
import DeleteDialog, { type DeleteResult } from 'containers/Bucket/Toolbar/DeleteDialog'
import * as Dialogs from 'utils/Dialogs'

interface OrganizeState {
  addToBookmarks: () => void
  removeFromBookmarks: () => void
  toggleBookmarks: () => void
  bookmarkStatus: 'none' | 'partial' | 'all'

  openSelectionPopup: () => void
  clearSelection: () => void

  confirmDeleteSelected: () => void

  selectionCount: number
}

const Context = React.createContext<OrganizeState | null>(null)

function useContext(): OrganizeState {
  const context = React.useContext(Context)
  invariant(context, 'useContext must be used within OrganizeDirProvider')
  return context
}

export const use = useContext

interface OrganizeProviderProps {
  children: React.ReactNode
  onReload: () => void
}

export function OrganizeProvider({ children, onReload }: OrganizeProviderProps) {
  const bookmarks = Bookmarks.use()
  const dialogs = Dialogs.use()
  const slt = Selection.use()

  const handles = React.useMemo(
    () => Selection.toHandlesList(slt.selection),
    [slt.selection],
  )

  const bookmarkStatus = React.useMemo(() => {
    if (!bookmarks || slt.isEmpty) return 'none'
    const bookmarkedCount = handles.filter((handle) =>
      bookmarks.isBookmarked('main', handle),
    ).length
    if (bookmarkedCount === 0) return 'none'
    if (bookmarkedCount === handles.length) return 'all'
    return 'partial'
  }, [bookmarks, slt.isEmpty, handles])

  const addToBookmarks = React.useCallback(() => {
    if (!bookmarks || slt.isEmpty) return
    bookmarks.append('main', handles)
  }, [bookmarks, slt.isEmpty, handles])

  const removeFromBookmarks = React.useCallback(() => {
    if (!bookmarks || slt.isEmpty) return
    bookmarks.remove('main', handles)
  }, [bookmarks, slt.isEmpty, handles])

  const toggleBookmarks = React.useCallback(() => {
    if (bookmarkStatus === 'all') {
      removeFromBookmarks()
    } else {
      addToBookmarks()
    }
  }, [bookmarkStatus, addToBookmarks, removeFromBookmarks])

  const openSelectionPopup = React.useCallback(() => {
    dialogs.open(({ close }) => <Selection.Popup close={close} />)
  }, [dialogs])

  const clearSelection = React.useCallback(() => {
    slt.clear()
  }, [slt])

  const confirmDeleteSelected = React.useCallback(async () => {
    if (slt.isEmpty) return

    const result = await dialogs.open<DeleteResult>(({ close }) => (
      <DeleteDialog close={close} handles={handles} />
    ))

    if (result.deleted) {
      onReload()
      slt.clear()
    }
  }, [dialogs, onReload, slt, handles])

  const selectionCount = slt.totalCount

  const actions = React.useMemo(
    (): OrganizeState => ({
      addToBookmarks,
      removeFromBookmarks,
      toggleBookmarks,
      bookmarkStatus,
      openSelectionPopup,
      clearSelection,
      confirmDeleteSelected,
      selectionCount,
    }),
    [
      addToBookmarks,
      removeFromBookmarks,
      toggleBookmarks,
      bookmarkStatus,
      openSelectionPopup,
      clearSelection,
      confirmDeleteSelected,
      selectionCount,
    ],
  )

  return (
    <Context.Provider value={actions}>
      {children}

      {dialogs.render({ fullWidth: true, maxWidth: 'sm' })}
    </Context.Provider>
  )
}

export { OrganizeProvider as Provider }
