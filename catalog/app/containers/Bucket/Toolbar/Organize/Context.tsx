import invariant from 'invariant'
import * as React from 'react'

import { useConfirm } from 'components/Dialog'
import * as Bookmarks from 'containers/Bookmarks'
import * as Dialogs from 'utils/Dialogs'

import * as Selection from '../../Selection'

interface OrganizeDirActions {
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
}

export function OrganizeDirProvider({ children }: OrganizeDirProviderProps) {
  const bookmarks = Bookmarks.use()
  const dialogs = Dialogs.use()
  const slt = Selection.use()

  const confirm = useConfirm({
    title: 'Delete selected items',
    submitTitle: 'Delete',
    onSubmit: () => {
      // FIXME
      // console.log('Delete selected items:', Selection.toHandlesList(slt.selection))
    },
  })

  const addSelectedToBookmarks = React.useCallback(() => {
    if (!bookmarks || slt.isEmpty) return
    bookmarks.append('main', Selection.toHandlesList(slt.selection))
  }, [bookmarks, slt.isEmpty, slt.selection])

  const openSelectionPopup = React.useCallback(() => {
    dialogs.open(({ close }) => <Selection.Popup close={close} />)
  }, [dialogs])

  const clearSelection = React.useCallback(() => {
    slt.clear()
  }, [slt])

  const confirmDeleteSelected = React.useCallback(() => {
    if (slt.isEmpty) return
    confirm.open()
  }, [confirm, slt.isEmpty])

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

      {confirm.render(<></>)}
    </Context.Provider>
  )
}

export { OrganizeDirProvider as Provider }
