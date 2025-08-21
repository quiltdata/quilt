import { join } from 'path'

import * as React from 'react'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import Log from 'utils/Logging'
import * as s3paths from 'utils/s3paths'

import { useUploads } from '../../PackageDialog/Uploads'
import * as FI from '../../PackageDialog/FilesInput'

import type { DirHandle } from '../types'

interface LocalEntry {
  file: FI.LocalFile
  path: string
}

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
  handle: DirHandle
  initial?: FI.FilesState['added']
  onClose: (reason?: 'upload-success') => void
}

export default function UploadDialog({
  handle,
  initial = {},
  onClose,
}: UploadDialogProps) {
  const [value, setValue] = React.useState<FI.FilesState['added']>(initial)
  const classes = useUploadDialogStyles()

  const [uploadState, setUploadState] = React.useState<UploadState>({ _tag: 'idle' })

  const submitting = uploadState._tag === 'uploading'
  const meta = React.useMemo(
    () => ({
      initial: toFilesState(initial),
      submitting,
    }),
    [initial, submitting],
  )

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

    const files = Object.entries(value).map(
      ([path, file]) => ({ path, file }) as LocalEntry,
    )
    try {
      const uploadedEntries = await upload({
        files,
        bucket: handle.bucket,
        getCanonicalKey: (key) => s3paths.withoutPrefix('/', join(handle.path, key)),
        getMeta: () => null,
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
      onChange: (s: FI.FilesState) => setValue(s.added),
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
          <FI.FilesInput
            className={classes.drop}
            input={input}
            meta={meta}
            onFilesAction={onFilesAction}
            title="Upload files"
            totalProgress={progress}
            validationErrors={null}
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
