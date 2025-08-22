import invariant from 'invariant'
import * as React from 'react'
import * as M from '@material-ui/core'

import Code from 'components/Code'
import * as Bookmarks from 'containers/Bookmarks'
import * as Notifications from 'containers/Notifications'
import * as Model from 'model'
import * as AWS from 'utils/AWS'
import * as Dialogs from 'utils/Dialogs'
import Log from 'utils/Logging'
import * as s3paths from 'utils/s3paths'

import * as Selection from '../../Selection'
import { deleteObject, useFilesListing } from '../../requests'

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

interface DeleteDialogProps {
  close: () => void
  onReload: () => void
}

function DeleteDialog({ close, onReload }: DeleteDialogProps) {
  const slt = Selection.use()
  const [submitting, setSubmitting] = React.useState(false)

  const s3 = AWS.S3.use()
  const { push } = Notifications.use()

  const getFiles = useFilesListing()
  const [selectionHandles, setSelectionHandles] = React.useState<
    Model.S3.S3ObjectLocation[] | null
  >(null)

  React.useEffect(() => {
    async function resolveHandles() {
      const handles = Selection.toHandlesList(slt.selection)
      const filesMap = await getFiles(handles)
      setSelectionHandles(Object.values(filesMap))
    }
    resolveHandles()
  }, [getFiles, slt.selection])

  const onSubmit = React.useCallback(async () => {
    setSubmitting(true)
    const errors: Array<{ handle: Model.S3.S3ObjectLocation; error: any }> = []
    let successCount = 0

    if (selectionHandles) {
      await Promise.all(
        selectionHandles.map(async (handle) => {
          try {
            await deleteObject({ s3, handle })
            successCount++
          } catch (error) {
            Log.error('Failed to delete object:', error)
            errors.push({ handle, error })
          }
        }),
      )
    }

    if (successCount > 0) {
      push(`Successfully deleted ${successCount} file${successCount !== 1 ? 's' : ''}`)
    }

    if (errors.length > 0) {
      const errorDetails = errors
        .slice(0, 3)
        .map(({ handle }) => s3paths.handleToS3Url(handle))
        .join(', ')
      const moreText = errors.length > 3 ? ` and ${errors.length - 3} more` : ''

      push(
        `Failed to delete ${errors.length} file${errors.length !== 1 ? 's' : ''}: ${errorDetails}${moreText}`,
      )
    }

    setSubmitting(false)
    slt.clear()
    close()
    onReload()
  }, [close, s3, slt, push, onReload, selectionHandles])

  return (
    <>
      <M.DialogTitle>Delete selected items</M.DialogTitle>
      <M.DialogContent>
        {selectionHandles ? (
          <M.List dense disablePadding>
            {selectionHandles.map(({ bucket, key, version }) => (
              <M.ListItem key={`${bucket}${key}${version}`} disableGutters>
                <M.ListItemText
                  primary={
                    <Code>
                      s3://{bucket}/{key}
                    </Code>
                  }
                  secondary={version}
                />
              </M.ListItem>
            ))}
          </M.List>
        ) : (
          <M.CircularProgress size={64} />
        )}
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
          Submit
        </M.Button>
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

  const openSelectionPopup = React.useCallback(() => {
    dialogs.open(({ close }) => <Selection.Popup close={close} />)
  }, [dialogs])

  const clearSelection = React.useCallback(() => {
    slt.clear()
  }, [slt])

  const confirmDeleteSelected = React.useCallback(async () => {
    if (slt.isEmpty) return
    dialogs.open(({ close }) => <DeleteDialog onReload={onReload} close={close} />)
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
