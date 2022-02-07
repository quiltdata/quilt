import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import Mono from 'components/Code'
import * as Config from 'utils/Config'
import * as IPC from 'utils/electron/ipc-provider'
import * as packageHandleUtils from 'utils/packageHandle'
import mkStorage from 'utils/storage'

import * as FileView from './FileView'
import Section from './Section'

interface DownloadButtonProps {
  bucket: string
  className: string
  label?: string
  onClick: () => void
  path?: string
}

export function DownloadButton({
  bucket,
  className,
  label,
  onClick,
  path,
}: DownloadButtonProps) {
  const { desktop, noDownload }: { desktop: boolean; noDownload: boolean } = Config.use()

  if (noDownload) return null

  if (desktop) {
    return (
      <FileView.DownloadButtonLayout
        className={className}
        label={label}
        icon="archive"
        type="submit"
        onClick={onClick}
      />
    )
  }

  return (
    <FileView.ZipDownloadForm
      className={className}
      suffix={`dir/${bucket}/${path}`}
      label={label}
    />
  )
}

const useConfirmDownloadDialogStyles = M.makeStyles({
  progressbar: {
    margin: '0 0 16px',
  },
  shrink: {
    width: 0,
  },
})

interface ConfirmDownloadDialogProps {
  localPath: string
  onClose: () => void
  open: boolean
  packageHandle: packageHandleUtils.PackageHandle
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | false
}

export function ConfirmDialog({
  localPath,
  onClose,
  open,
  maxWidth = 'md',
  packageHandle,
}: ConfirmDownloadDialogProps) {
  const ipc = IPC.use()

  const classes = useConfirmDownloadDialogStyles()
  const [syncing, setSyncing] = React.useState(false)

  const handleCancel = React.useCallback(() => onClose(), [onClose])
  const handleConfirm = React.useCallback(async () => {
    setSyncing(true)
    await ipc.invoke(IPC.EVENTS.DOWNLOAD_PACKAGE, packageHandle, localPath)
    onClose()
  }, [ipc, localPath, onClose, packageHandle])

  const [fakeProgress, setFakeProgress] = React.useState(0)
  const handleCliOutput = React.useCallback(() => {
    if (fakeProgress) {
      setFakeProgress((100 - fakeProgress) * 0.1 + fakeProgress)
    } else {
      setFakeProgress(1)
      setTimeout(() => {
        setFakeProgress((100 - fakeProgress) * 0.1 + fakeProgress)
      }, 300)
    }
  }, [fakeProgress, setFakeProgress])
  React.useEffect(() => {
    ipc.on(IPC.EVENTS.CLI_OUTPUT, handleCliOutput)
    return () => {
      ipc.off(IPC.EVENTS.CLI_OUTPUT, handleCliOutput)
    }
  }, [ipc, handleCliOutput])
  const progressVariant = fakeProgress ? 'determinate' : 'indeterminate'

  return (
    <M.Dialog maxWidth={maxWidth} open={open}>
      <M.DialogTitle>Confirm download</M.DialogTitle>
      <M.DialogContent>
        {syncing && (
          <M.LinearProgress
            color="primary"
            className={cx(classes.progressbar, { [classes.shrink]: fakeProgress === 1 })}
            variant={progressVariant}
            value={fakeProgress === 1 ? 0 : fakeProgress}
          />
        )}
        From <Mono>{`s3://${packageHandle.bucket}/${packageHandle.name}`}</Mono> to{' '}
        <Mono>{localPath}</Mono>
      </M.DialogContent>
      <M.DialogActions>
        <M.Button disabled={syncing} onClick={handleCancel}>
          Cancel
        </M.Button>
        <M.Button
          disabled={syncing}
          color="primary"
          onClick={handleConfirm}
          variant="contained"
        >
          Download
        </M.Button>
      </M.DialogActions>
    </M.Dialog>
  )
}

interface LocalFolderInputProps {
  onChange: (path: string) => void
  open: boolean
  value: string | null
}

export function LocalFolderInput({ onChange, open, value }: LocalFolderInputProps) {
  const ipc = IPC.use()

  const handleClick = React.useCallback(async () => {
    const newLocalPath = await ipc.invoke(IPC.EVENTS.LOCALPATH_REQUEST)
    if (!newLocalPath) return
    onChange(newLocalPath)
  }, [ipc, onChange])

  return (
    <Section
      icon="folder_open"
      extraSummary={null}
      heading="Local folder"
      defaultExpanded={open}
      gutterTop
      gutterBottom
    >
      <M.TextField
        fullWidth
        size="small"
        disabled={false}
        helperText="Click to set local folder with your file browser"
        id="localPath"
        label="Path to local folder"
        onClick={handleClick}
        value={value}
      />
    </Section>
  )
}

const STORAGE_KEYS = {
  LOCAL_FOLDER: 'LOCAL_FOLDER',
}
const storage = mkStorage({
  [STORAGE_KEYS.LOCAL_FOLDER]: STORAGE_KEYS.LOCAL_FOLDER,
})

export function useLocalFolder(): [string, (v: string) => void] {
  const [value, setValue] = React.useState(() => {
    try {
      return storage.get(STORAGE_KEYS.LOCAL_FOLDER) || ''
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(error)
      return ''
    }
  })
  const onChange = React.useCallback(
    (path) => {
      storage.set(STORAGE_KEYS.LOCAL_FOLDER, path)
      setValue(path)
    },
    [setValue],
  )
  return React.useMemo(() => [value, onChange], [value, onChange])
}
