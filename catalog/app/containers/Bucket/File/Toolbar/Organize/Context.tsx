import invariant from 'invariant'
import * as React from 'react'

import * as Bookmarks from 'containers/Bookmarks'
import type * as Toolbar from 'containers/Bucket/Toolbar'
import DeleteDialog, { type DeleteResult } from 'containers/Bucket/Toolbar/DeleteDialog'
import * as FileEditor from 'components/FileEditor'
import * as Dialogs from 'utils/Dialogs'

interface OrganizeState {
  toggleBookmark: () => void
  isBookmarked: boolean

  editFile: (type: FileEditor.EditorInputType) => void
  editTypes: FileEditor.EditorInputType[]

  confirmDelete: () => void

  handle: Toolbar.FileHandle
}

const Context = React.createContext<OrganizeState | null>(null)

function useContext(): OrganizeState {
  const context = React.useContext(Context)
  invariant(context, 'useOrganizeFileActions must be used within OrganizeFileProvider')
  return context
}

export const use = useContext

interface OrganizeProviderProps {
  children: React.ReactNode
  editorState: FileEditor.EditorState
  handle: Toolbar.FileHandle
  onReload: () => void
}

function OrganizeProvider({
  children,
  editorState,
  handle,
  onReload,
}: OrganizeProviderProps) {
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
    const result = await dialogs.open<DeleteResult>(({ close }) => (
      <DeleteDialog handles={[handle]} close={close} />
    ))

    if (result.deleted) {
      onReload()
    }
  }, [dialogs, handle, onReload])

  const actions = React.useMemo(
    (): OrganizeState => ({
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

export { OrganizeProvider as Provider }
