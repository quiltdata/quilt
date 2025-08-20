import invariant from 'invariant'
import * as React from 'react'
import * as M from '@material-ui/core'

import * as Dialogs from 'utils/Dialogs'
import * as FileEditor from 'components/FileEditor'

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

const useUploadDialogStyles = M.makeStyles((t) => ({
  drop: {
    height: t.spacing(60),
    marginBottom: t.spacing(1),
  },
}))

interface UploadDialogProps {
  bucket: string
  path: string
  initial: FI.FilesState
  onClose: () => void
}

function UploadDialog({ initial, bucket, onClose }: UploadDialogProps) {
  const [uploads, setUploads] = React.useState<FI.FilesState>(initial)
  const classes = useUploadDialogStyles()

  const [meta, setMeta] = React.useState(() => ({ initial, submitting: false }))
  React.useEffect(() => {
    setMeta((m) => ({ ...m, initial }))
  }, [initial])

  const onUpload = React.useCallback(() => {
    setMeta((m) => ({ ...m, submitting: true }))
    // FIXME: Implement actual upload logic
    setTimeout(() => {
      setMeta((m) => ({ ...m, submitting: false }))
      onClose()
    }, 3000)
  }, [onClose])

  return (
    <>
      <M.DialogContent>
        <FI.FilesInput
          noActions
          className={classes.drop}
          meta={meta}
          input={{
            value: uploads,
            onChange: setUploads,
          }}
          title="Upload files"
          totalProgress={totalProgress}
          bucket={bucket}
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
          disabled={!Object.keys(uploads.added).length || meta.submitting}
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
      <UploadDialog {...handle} initial={INITIAL} onClose={close} />
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
