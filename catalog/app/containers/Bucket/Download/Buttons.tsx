import * as React from 'react'
import * as M from '@material-ui/core'
import * as Icons from '@material-ui/icons'

import { SplitCopyButton, usePopoverClose } from 'components/Buttons'
import type * as Model from 'model'
import * as AWS from 'utils/AWS'

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

const useDownloadButtonStyles = M.makeStyles({
  root: {
    justifyContent: 'flex-start',
    lineHeight: '1.25rem',
    width: '100%',
  },
})

interface DownloadFileProps {
  fileHandle: Model.S3.S3ObjectLocation
  s3Uri?: string
}

export function DownloadFile({
  fileHandle,
  s3Uri,
  ...props
}: DownloadFileProps & M.ButtonProps<'a'>) {
  const url = AWS.Signer.useDownloadUrl(fileHandle)
  const classes = useDownloadButtonStyles()
  if (s3Uri) {
    return (
      <SplitCopyButton
        copyUri={s3Uri}
        icon={<Icons.ArrowDownwardOutlined />}
        download
        href={url}
        {...props}
      >
        Download file
      </SplitCopyButton>
    )
  }
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
  s3Uri?: string
}

export function DownloadDir({
  children,
  fileHandles,
  className,
  suffix,
  s3Uri,
  ...props
}: DownloadDirProps & M.ButtonProps) {
  const classes = useDownloadButtonStyles()
  const files = React.useMemo(
    () => fileHandles && fileHandles.map(({ key }) => key),
    [fileHandles],
  )
  return (
    <ZipDownloadForm className={className} files={files} suffix={suffix}>
      {s3Uri ? (
        <SplitCopyButton
          copyUri={s3Uri}
          icon={<Icons.ArchiveOutlined />}
          type="submit"
          {...props}
        >
          <span>{children}</span>
        </SplitCopyButton>
      ) : (
        <M.Button
          className={classes.root}
          startIcon={<Icons.ArchiveOutlined />}
          type="submit"
          {...props}
        >
          <span>{children}</span>
        </M.Button>
      )}
    </ZipDownloadForm>
  )
}
