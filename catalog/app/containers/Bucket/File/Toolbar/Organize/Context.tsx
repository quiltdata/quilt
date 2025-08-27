import invariant from 'invariant'
import * as React from 'react'

import * as M from '@material-ui/core'

import Code from 'components/Code'
import * as Bookmarks from 'containers/Bookmarks'
import type * as Toolbar from 'containers/Bucket/Toolbar'
import { deleteObject } from 'containers/Bucket/requests'
import * as FileEditor from 'components/FileEditor'
import * as Notifications from 'containers/Notifications'
import * as AWS from 'utils/AWS'
import * as Dialogs from 'utils/Dialogs'
import Log from 'utils/Logging'
import * as s3paths from 'utils/s3paths'

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

interface DeleteDialogProps {
  close: () => void
  handle: Toolbar.FileHandle
  onReload: () => void
}

function DeleteDialog({ close, handle, onReload }: DeleteDialogProps) {
  const [submitting, setSubmitting] = React.useState(false)
  const s3 = AWS.S3.use()
  const { push } = Notifications.use()

  const onSubmit = React.useCallback(async () => {
    setSubmitting(true)
    try {
      await deleteObject({ s3, handle })
      push(`${s3paths.handleToS3Url(handle)} deleted successfully`)
      close()
      onReload()
    } catch (error) {
      Log.error('Failed to delete file:', error)
      push(`Failed deleting ${s3paths.handleToS3Url(handle)}`)
    }
    setSubmitting(false)
  }, [s3, handle, push, close, onReload])

  return (
    <>
      <M.DialogTitle>Delete object?</M.DialogTitle>
      <M.DialogContent>
        <Code>
          s3://{handle.bucket}/{handle.key}
        </Code>
      </M.DialogContent>
      <M.DialogActions>
        <M.Button onClick={close} color="primary" variant="outlined">
          Cancel
        </M.Button>
        <M.Button
          color="primary"
          disabled={submitting}
          variant="contained"
          onClick={onSubmit}
        >
          Delete
        </M.Button>
      </M.DialogActions>
    </>
  )
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
      <DeleteDialog handle={handle} onReload={onReload} close={close} />
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
