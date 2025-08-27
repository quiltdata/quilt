import invariant from 'invariant'
import * as React from 'react'

import * as Bookmarks from 'containers/Bookmarks'
import type * as Toolbar from 'containers/Bucket/Toolbar'
import DeleteDialog from 'containers/Bucket/Toolbar/DeleteDialog'
import * as FileEditor from 'components/FileEditor'
import * as Dialogs from 'utils/Dialogs'

export interface OrganizeFileActions {
  toggleBookmark: () => void
  isBookmarked: boolean

  editFile: (type: FileEditor.EditorInputType) => void
  editTypes: FileEditor.EditorInputType[]

  confirmDelete: () => void

  handle: Toolbar.FileHandle
}

export const Context = React.createContext<OrganizeFileActions | null>(null)

function useContext(): OrganizeFileActions {
  const context = React.useContext(Context)
  invariant(context, 'useOrganizeFileActions must be used within OrganizeFileProvider')
  return context
}

export const use = useContext

interface OrganizeFileProviderProps {
  children: React.ReactNode
  editorState: FileEditor.EditorState
  handle: Toolbar.FileHandle
  onReload: () => void
}

export function OrganizeFileProvider({
  children,
  editorState,
  handle,
  onReload,
}: OrganizeFileProviderProps) {
  const bookmarks = Bookmarks.use()
  const dialogs = Dialogs.use()

  invariant(editorState, '`editorState` should be provided')

  const isBookmarked = React.useMemo(
    () => (bookmarks ? bookmarks.isBookmarked('main', handle) : false),
    [bookmarks, handle],
  )

  const toggleBookmark = React.useCallback(() => {
    if (!bookmarks) return
    bookmarks.toggle('main', handle)
  }, [bookmarks, handle])

  const editFile = React.useCallback(
    (type: FileEditor.EditorInputType) => {
      editorState.onEdit(type)
    },
    [editorState],
  )

  const confirmDelete = React.useCallback(async () => {
    dialogs.open(({ close }) => (
      <DeleteDialog handles={[handle]} onComplete={onReload} close={close} />
    ))
  }, [dialogs, handle, onReload])

  const actions = React.useMemo(
    (): OrganizeFileActions => ({
      toggleBookmark,
      isBookmarked,
      editFile,
      editTypes: editorState.types,
      confirmDelete,
      handle,
    }),
    [editorState.types, toggleBookmark, isBookmarked, editFile, confirmDelete, handle],
  )

  return (
    <Context.Provider value={actions}>
      {children}
      {dialogs.render({ fullWidth: true, maxWidth: 'sm' })}
    </Context.Provider>
  )
}

export { OrganizeFileProvider as Provider }
