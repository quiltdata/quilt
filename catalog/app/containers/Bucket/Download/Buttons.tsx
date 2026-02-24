import * as React from 'react'
import * as M from '@material-ui/core'
import * as Icons from '@material-ui/icons'

import { usePopoverClose } from 'components/Buttons'
import * as Notifications from 'containers/Notifications'
import type * as Model from 'model'
import * as AWS from 'utils/AWS'
import copyToClipboard from 'utils/clipboard'

import { ZipDownloadForm } from '../FileView'

export function useDownloadFeedback(): {
  onClick: () => void
  startIcon?: React.ReactNode
} {
  const closePopover = usePopoverClose()
  const [downloading, setDownloading] = React.useState(false)
  React.useEffect(() => {
    if (!downloading) return
    const timer = setTimeout(() => {
      setDownloading(false)
      closePopover()
    }, 1000)
    return () => clearTimeout(timer)
  }, [downloading, closePopover])
  return React.useMemo(
    () => ({
      onClick: () => setDownloading(true),
      ...(downloading ? { startIcon: <M.CircularProgress size={20} /> } : null),
    }),
    [downloading],
  )
}

const useSplitCopyButtonStyles = M.makeStyles((t) => ({
  root: {
    whiteSpace: 'nowrap',
    width: '100%',
  },
  copy: {
    fontSize: t.typography.body1.fontSize,
    width: 'auto',
  },
}))

interface SplitCopyButtonProps {
  children: React.ReactNode
  className?: string
  copyUri: string
  notification?: string
}

export function SplitCopyButton({
  children,
  className,
  copyUri,
  notification = 'URI has been copied to clipboard',
}: SplitCopyButtonProps) {
  const classes = useSplitCopyButtonStyles()
  const { push } = Notifications.use()
  const handleCopy = React.useCallback(() => {
    copyToClipboard(copyUri)
    push(notification)
  }, [copyUri, notification, push])
  return (
    <M.ButtonGroup variant="outlined" className={`${classes.root} ${className || ''}`}>
      {children}
      <M.Button type="button" className={classes.copy} onClick={handleCopy}>
        <Icons.FileCopy fontSize="inherit" />
      </M.Button>
    </M.ButtonGroup>
  )
}

const useDownloadButtonStyles = M.makeStyles({
  root: {
    justifyContent: 'flex-start',
    lineHeight: '1.25rem',
    width: '100%',
  },
})

interface DownloadFileProps {
  fileHandle: Model.S3.S3ObjectLocation
}

export function DownloadFile({
  fileHandle,
  ...props
}: DownloadFileProps & M.ButtonProps<'a'>) {
  const url = AWS.Signer.useDownloadUrl(fileHandle)
  const classes = useDownloadButtonStyles()
  return (
    <M.Button
      className={classes.root}
      download
      href={url}
      startIcon={<Icons.ArrowDownwardOutlined />}
      {...props}
    >
      Download file
    </M.Button>
  )
}

interface DownloadDirProps {
  className?: string
  suffix: string
  fileHandles?: Model.S3.S3ObjectLocation[]
  children: React.ReactNode
}

export function DownloadDir({
  children,
  fileHandles,
  className,
  suffix,
  ...props
}: DownloadDirProps & M.ButtonProps) {
  const classes = useDownloadButtonStyles()
  const files = React.useMemo(
    () => fileHandles && fileHandles.map(({ key }) => key),
    [fileHandles],
  )
  return (
    <ZipDownloadForm className={className} files={files} suffix={suffix}>
      <M.Button
        className={classes.root}
        startIcon={<Icons.ArchiveOutlined />}
        type="submit"
        {...props}
      >
        <span>{children}</span>
      </M.Button>
    </ZipDownloadForm>
  )
}
