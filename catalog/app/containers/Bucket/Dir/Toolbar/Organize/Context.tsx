import invariant from 'invariant'
import * as React from 'react'
import * as M from '@material-ui/core'

import Code from 'components/Code'
import * as Bookmarks from 'containers/Bookmarks'
import * as Selection from 'containers/Bucket/Selection'
import { deleteObject, useFilesListing } from 'containers/Bucket/requests'
import * as Model from 'model'
import * as AWS from 'utils/AWS'
import * as Dialogs from 'utils/Dialogs'
import Log from 'utils/Logging'

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

type FileStatus = 'pending' | 'success' | 'error'

interface ResolvedObject {
  handle: Model.S3.S3ObjectLocation
  status: FileStatus
  error?: any
}

interface DeleteDialogProps {
  close: () => void
  onReload: () => void
  handles: Model.S3.S3ObjectLocation[]
}

function DeleteDialog({ close, onReload, handles }: DeleteDialogProps) {
  const [submitting, setSubmitting] = React.useState(false)
  const [resolvedObjects, setResolvedObjects] = React.useState<ResolvedObject[] | null>(
    null,
  )

  const hasErrors = React.useMemo(
    () => resolvedObjects?.some((obj) => obj.status === 'error') ?? false,
    [resolvedObjects],
  )

  const isComplete = React.useMemo(
    () => resolvedObjects?.every((obj) => obj.status !== 'pending') ?? false,
    [resolvedObjects],
  )

  const s3 = AWS.S3.use()
  const getFiles = useFilesListing()

  React.useEffect(() => {
    async function resolveHandles() {
      const filesMap = await getFiles(handles)
      const resolved = Object.values(filesMap)
      setResolvedObjects(
        resolved.map((handle) => ({ handle, status: 'pending' as FileStatus })),
      )
    }
    resolveHandles()
  }, [getFiles, handles])

  const onSubmit = React.useCallback(async () => {
    setSubmitting(true)

    if (resolvedObjects) {
      const results = await Promise.all(
        resolvedObjects.map(async ({ handle }) => {
          try {
            await deleteObject({ s3, handle })
            return { status: 'success' as FileStatus, error: undefined }
          } catch (error) {
            Log.error('Failed to delete object:', error)
            return { status: 'error' as FileStatus, error }
          }
        }),
      )

      setResolvedObjects((prev) =>
        prev!.map((item, index) => ({
          ...item,
          status: results[index].status,
          error: results[index].error,
        })),
      )

      onReload()
    }

    setSubmitting(false)
  }, [s3, onReload, resolvedObjects])

  return (
    <>
      <M.DialogTitle>
        {isComplete
          ? hasErrors
            ? 'Some files could not be deleted'
            : 'Files deleted successfully'
          : 'Delete selected objects?'}
      </M.DialogTitle>
      <M.DialogContent>
        {resolvedObjects ? (
          <M.List dense disablePadding>
            {resolvedObjects.map(
              ({ handle: { bucket, key, version }, status, error }) => (
                <M.ListItem key={`${bucket}${key}${version}`} disableGutters>
                  {status === 'error' && (
                    <M.Tooltip title={error.message}>
                      <M.ListItemIcon>
                        <M.Icon color="error">error</M.Icon>
                      </M.ListItemIcon>
                    </M.Tooltip>
                  )}
                  <M.ListItemText
                    primary={
                      <Code
                        style={
                          status === 'success'
                            ? { textDecoration: 'line-through' }
                            : undefined
                        }
                      >
                        s3://{bucket}/{key}
                      </Code>
                    }
                    secondary={version}
                  />
                </M.ListItem>
              ),
            )}
          </M.List>
        ) : (
          <M.CircularProgress size={64} />
        )}
      </M.DialogContent>
      <M.DialogActions>
        <M.Button onClick={close} color="primary" variant="outlined">
          {isComplete ? 'Close' : 'Cancel'}
        </M.Button>
        {!isComplete && (
          <M.Button
            color="primary"
            disabled={submitting}
            variant="contained"
            onClick={onSubmit}
          >
            Submit
          </M.Button>
        )}
      </M.DialogActions>
    </>
  )
}

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
      <DeleteDialog onReload={onReload} close={close} handles={handles} />
    ))

    slt.clear()
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
