import invariant from 'invariant'
import * as React from 'react'

import Code from 'components/Code'
import { useConfirm } from 'components/Dialog'
import * as Bookmarks from 'containers/Bookmarks'
import type * as Toolbar from 'containers/Bucket/Toolbar'
import { deleteObject } from 'containers/Bucket/requests'
import * as FileEditor from 'components/FileEditor'
import * as Notifications from 'containers/Notifications'
import * as AWS from 'utils/AWS'
import Log from 'utils/Logging'
import * as s3paths from 'utils/s3paths'

export interface OrganizeFileActions {
  toggleBookmark: () => void
  isBookmarked: boolean

  editFile: () => void
  canEdit: boolean

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
  const s3 = AWS.S3.use()
  const { push } = Notifications.use()

  invariant(editorState, '`editorState` should be provided')

  const isBookmarked = React.useMemo(
    () => (bookmarks ? bookmarks.isBookmarked('main', handle) : false),
    [bookmarks, handle],
  )

  const toggleBookmark = React.useCallback(() => {
    if (!bookmarks) return
    bookmarks.toggle('main', handle)
  }, [bookmarks, handle])

  const canEdit = React.useMemo(
    () => FileEditor.isSupportedFileType(handle.key),
    [handle.key],
  )

  const editFile = React.useCallback(() => {
    if (!canEdit) return
    editorState.onEdit(editorState.types[0])
  }, [canEdit, editorState])

  const handleDelete = React.useCallback(async () => {
    try {
      await deleteObject({ s3, handle })
      push(`${s3paths.handleToS3Url(handle)} deleted successfully`)
      onReload()
    } catch (error) {
      Log.error('Failed to delete file:', error)
      push(`Failed deleting ${s3paths.handleToS3Url(handle)}`)
    }
  }, [s3, handle, push, onReload])

  const deleteConfirm = useConfirm({
    title: 'Delete object?',
    submitTitle: 'Delete',
    onSubmit: (confirmed: boolean) => (confirmed ? handleDelete() : Promise.resolve()),
  })

  const confirmDelete = React.useCallback(() => {
    deleteConfirm.open()
  }, [deleteConfirm])

  const actions = React.useMemo(
    (): OrganizeFileActions => ({
      toggleBookmark,
      isBookmarked,
      editFile,
      canEdit,
      confirmDelete,
      handle,
    }),
    [toggleBookmark, isBookmarked, editFile, canEdit, confirmDelete, handle],
  )

  return (
    <Context.Provider value={actions}>
      {children}
      {deleteConfirm.render(<Code>{s3paths.handleToS3Url(handle)}</Code>)}
    </Context.Provider>
  )
}

export { OrganizeFileProvider as Provider }
