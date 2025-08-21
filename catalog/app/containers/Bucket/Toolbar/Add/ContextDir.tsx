import { join } from 'path'

import invariant from 'invariant'
import * as React from 'react'
import * as M from '@material-ui/core'

import * as FileEditor from 'components/FileEditor'
import * as Dialogs from 'utils/Dialogs'
import Log from 'utils/Logging'
import * as s3paths from 'utils/s3paths'

import { useUploads } from '../../PackageDialog/Uploads'
import * as FI from '../../PackageDialog/FilesInput'
import type { DirHandle } from '../types'

interface AddDirActions {
  // File creation
  createFile: () => void

  // Upload files
  openUploadDialog: () => void
}

const AddDirContext = React.createContext<AddDirActions | null>(null)

export function useAddDirActions(): AddDirActions {
  const context = React.useContext(AddDirContext)
  invariant(context, 'useAddDirActions must be used within AddDirProvider')
  return context
}

const totalProgress = {
  total: 0,
  loaded: 0,
  percent: 0,
}

const INITIAL = {
  added: {},
  deleted: {},
  existing: {},
}

interface LocalEntry {
  path: string
  file: FI.LocalFile
}

const useUploadDialogStyles = M.makeStyles((t) => ({
  drop: {
    height: t.spacing(60),
    marginBottom: t.spacing(1),
  },
}))

interface UploadDialogProps {
  handle: DirHandle
  initial: FI.FilesState
  onClose: () => void
}

function UploadDialog({ handle, initial, onClose }: UploadDialogProps) {
  // TODO: use value.added only
  //       alwayse keep {existing: {}, removing: {}} empty
  //       input = useMemo({value: {added, existing:{}, removed: {}}, onChange})
  const [value, onChange] = React.useState<FI.FilesState>(initial)
  const classes = useUploadDialogStyles()

  const [meta, setMeta] = React.useState(() => ({ initial, submitting: false }))
  React.useEffect(() => {
    setMeta((m) => ({ ...m, initial }))
  }, [initial])

  const { remove, removeByPrefix, reset, upload } = useUploads()
  const onFilesAction = React.useMemo(
    () =>
      FI.FilesAction.match({
        _: () => {},
        Revert: remove,
        RevertDir: removeByPrefix,
        Reset: reset,
      }),
    [remove, removeByPrefix, reset],
  )

  const onUpload = React.useCallback(async () => {
    setMeta((m) => ({ ...m, submitting: true }))

    const files = Object.entries(value.added).map(
      ([path, file]) => ({ path, file }) as LocalEntry,
    )
    try {
      const uploadedEntries = await upload({
        files,
        bucket: handle.bucket,
        getCanonicalKey: (key) => s3paths.withoutPrefix('/', join(handle.path, key)),
        getMeta: () => null,
      })
      Log.log(uploadedEntries)
      // FIXME: show success
    } catch (e) {
      // FIXME: show error
      Log.error(e)
    }

    setMeta((m) => ({ ...m, submitting: false }))
    onClose()
  }, [onClose, value, handle, upload])

  return (
    <>
      <M.DialogContent>
        <FI.FilesInput
          className={classes.drop}
          input={{ value, onChange }}
          meta={meta}
          onFilesAction={onFilesAction}
          title="Upload files"
          totalProgress={totalProgress}
          validationErrors={null}
        />
      </M.DialogContent>
      <M.DialogActions>
        <M.Button color="primary" onClick={onClose}>
          Cancel
        </M.Button>
        <M.Button
          color="primary"
          variant="contained"
          disabled={!Object.keys(value.added).length || meta.submitting}
          onClick={onUpload}
        >
          Upload
        </M.Button>
      </M.DialogActions>
    </>
  )
}

interface AddDirProviderProps {
  children: React.ReactNode
  handle: DirHandle
}

export function AddDirProvider({ children, handle }: AddDirProviderProps) {
  const dialogs = Dialogs.use()
  const prompt = FileEditor.useCreateFileInBucket(handle.bucket, handle.path)

  const createFile = React.useCallback(() => {
    prompt.open()
  }, [prompt])

  const openUploadDialog = React.useCallback(() => {
    dialogs.open(({ close }) => (
      <UploadDialog handle={handle} initial={INITIAL} onClose={close} />
    ))
  }, [dialogs, handle])

  const actions = React.useMemo(
    (): AddDirActions => ({
      createFile,
      openUploadDialog,
    }),
    [createFile, openUploadDialog],
  )

  return (
    <AddDirContext.Provider value={actions}>
      {children}

      {prompt.render()}

      {dialogs.render({ fullWidth: true, maxWidth: 'sm' })}
    </AddDirContext.Provider>
  )
}

export { AddDirProvider as Provider }
