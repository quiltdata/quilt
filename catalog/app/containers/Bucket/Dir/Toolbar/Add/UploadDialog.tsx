import { join } from 'path'

import * as React from 'react'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import { useUploads } from 'containers/Bucket/PackageDialog/Uploads'
import * as FI from 'containers/Bucket/PackageDialog/Inputs/Files/State'
import { FilesInput } from 'containers/Bucket/PackageDialog/Inputs/Files/Input'
import type * as Toolbar from 'containers/Bucket/Toolbar'
import Log from 'utils/Logging'

const useUploadDialogStyles = M.makeStyles((t) => ({
  drop: {
    height: t.spacing(60),
    marginBottom: t.spacing(1),
  },
  alert: {
    marginBottom: t.spacing(2),
  },
}))

const toFilesState = (added: FI.FilesState['added']): FI.FilesState => ({
  added,
  existing: {},
  deleted: {},
})

type UploadState =
  | { _tag: 'idle' }
  | { _tag: 'uploading' }
  | { _tag: 'success'; count: number }
  | { _tag: 'error'; error: Error }

interface UploadDialogProps {
  handle: Toolbar.DirHandle
  initial?: FI.FilesState['added']
  onClose: (reason?: 'upload-success') => void
}

export default function UploadDialog({
  handle,
  initial: added = {},
  onClose,
}: UploadDialogProps) {
  const [value, setValue] = React.useState<FI.FilesState['added']>(added)
  const classes = useUploadDialogStyles()

  const [uploadState, setUploadState] = React.useState<UploadState>({ _tag: 'idle' })

  const submitting = uploadState._tag === 'uploading'
  const initial = React.useMemo(() => toFilesState(added), [added])

  const { progress, remove, removeByPrefix, reset, upload } = useUploads()
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
    setUploadState({ _tag: 'uploading' })

    const { local: files } = FI.groupAddedFiles(value)
    try {
      const uploadedEntries = await upload({
        files,
        bucket: handle.bucket,
        getCanonicalKey: (key) => join(handle.path, key),
      })
      setUploadState({ _tag: 'success', count: Object.keys(uploadedEntries).length })
    } catch (e) {
      Log.error(e)
      const error = e instanceof Error ? e : new Error('Upload failed')
      setUploadState({ _tag: 'error', error })
    }
  }, [handle, upload, value])

  const handleClose = React.useCallback(() => {
    if (uploadState._tag === 'uploading') return
    if (uploadState._tag === 'success') {
      onClose('upload-success')
    } else {
      onClose()
    }
  }, [onClose, uploadState])

  const input = React.useMemo(
    () => ({
      value: toFilesState(value),
      // Trigger value update, because hashing finishes on the same objects
      onChange: (s: FI.FilesState) => setValue({ ...s.added }),
    }),
    [value],
  )

  const showUploadUI = uploadState._tag === 'idle' || uploadState._tag === 'uploading'

  return (
    <>
      <M.DialogContent>
        {uploadState._tag === 'success' && (
          <Lab.Alert severity="success" className={classes.alert}>
            Successfully uploaded {uploadState.count} file
            {uploadState.count !== 1 ? 's' : ''}!
          </Lab.Alert>
        )}

        {uploadState._tag === 'error' && (
          <Lab.Alert
            severity="error"
            className={classes.alert}
            onClose={() => setUploadState({ _tag: 'idle' })}
          >
            <Lab.AlertTitle>Upload Failed</Lab.AlertTitle>
            {uploadState.error.message}
          </Lab.Alert>
        )}

        {showUploadUI && (
          <FilesInput
            className={classes.drop}
            disabled={submitting}
            initial={initial}
            noMeta
            onChange={input.onChange}
            onFilesAction={onFilesAction}
            title="Upload files"
            totalProgress={progress}
            value={input.value}
          />
        )}
      </M.DialogContent>
      <M.DialogActions>
        <M.Button
          color="primary"
          onClick={handleClose}
          disabled={uploadState._tag === 'uploading'}
        >
          {uploadState._tag === 'success' ? 'Close' : 'Cancel'}
        </M.Button>
        {uploadState._tag !== 'success' && (
          <M.Button
            color="primary"
            variant="contained"
            disabled={!Object.keys(value).length || uploadState._tag === 'uploading'}
            onClick={onUpload}
          >
            {uploadState._tag === 'uploading' ? 'Uploading...' : 'Upload'}
          </M.Button>
        )}
      </M.DialogActions>
    </>
  )
}
