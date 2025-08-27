import invariant from 'invariant'
import * as React from 'react'

import * as Bookmarks from 'containers/Bookmarks'
import * as Selection from 'containers/Bucket/Selection'
import DeleteDialog from 'containers/Bucket/Toolbar/DeleteDialog'
import * as Dialogs from 'utils/Dialogs'

export interface OrganizeDirActions {
  addSelectedToBookmarks: () => void

  openSelectionPopup: () => void
  clearSelection: () => void

  confirmDeleteSelected: () => void

  selectionCount: number
}

const Context = React.createContext<OrganizeDirActions | null>(null)

function useContext(): OrganizeDirActions {
  const context = React.useContext(Context)
  invariant(context, 'useOrganizeDirActions must be used within OrganizeDirProvider')
  return context
}

export const use = useContext

interface OrganizeDirProviderProps {
  children: React.ReactNode
  onReload: () => void
}

export function OrganizeDirProvider({ children, onReload }: OrganizeDirProviderProps) {
  const bookmarks = Bookmarks.use()
  const dialogs = Dialogs.use()
  const slt = Selection.use()

  const addSelectedToBookmarks = React.useCallback(() => {
    if (!bookmarks || slt.isEmpty) return
    bookmarks.append('main', Selection.toHandlesList(slt.selection))
  }, [bookmarks, slt.isEmpty, slt.selection])

  // const handles =  Selection.toHandlesList(slt.selection)
  // TODO: is everything is bookmarked on the same level of directory hierarchy
  // const isBookmarked = bookmarks.isBookmarked('main', handle)

  const openSelectionPopup = React.useCallback(() => {
    dialogs.open(({ close }) => <Selection.Popup close={close} />)
  }, [dialogs])

  const clearSelection = React.useCallback(() => {
    slt.clear()
  }, [slt])

  const confirmDeleteSelected = React.useCallback(async () => {
    if (slt.isEmpty) return

    const handles = Selection.toHandlesList(slt.selection)

    dialogs.open(({ close }) => (
      <DeleteDialog
        onComplete={() => {
          onReload()
          slt.clear()
        }}
        close={close}
        handles={handles}
      />
    ))
  }, [dialogs, onReload, slt])

  const selectionCount = slt.totalCount

  const actions = React.useMemo(
    (): OrganizeDirActions => ({
      addSelectedToBookmarks,
      openSelectionPopup,
      clearSelection,
      confirmDeleteSelected,
      selectionCount,
    }),
    [
      addSelectedToBookmarks,
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

export { OrganizeDirProvider as Provider }
