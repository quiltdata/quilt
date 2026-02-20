import * as React from 'react'
import * as M from '@material-ui/core'
import * as Icons from '@material-ui/icons'

import * as Buttons from 'components/Buttons'
import type * as Model from 'model'
import * as AWS from 'utils/AWS'

import { ZipDownloadForm } from '../FileView'

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

export function DownloadFile({ fileHandle }: DownloadFileProps) {
  const url = AWS.Signer.useDownloadUrl(fileHandle)
  const classes = useDownloadButtonStyles()
  const closePopover = Buttons.usePopoverClose()
  return (
    <M.Button
      className={classes.root}
      download
      href={url}
      onClick={closePopover}
      startIcon={<Icons.ArrowDownwardOutlined />}
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
  onClick,
  ...props
}: DownloadDirProps & M.ButtonProps) {
  const classes = useDownloadButtonStyles()
  const closePopover = Buttons.usePopoverClose()
  const files = React.useMemo(
    () => fileHandles && fileHandles.map(({ key }) => key),
    [fileHandles],
  )
  const handleClick = React.useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      closePopover()
      onClick?.(e)
    },
    [closePopover, onClick],
  )
  return (
    <ZipDownloadForm className={className} files={files} suffix={suffix}>
      <M.Button
        className={classes.root}
        startIcon={<Icons.ArchiveOutlined />}
        type="submit"
        onClick={handleClick}
        {...props}
      >
        <span>{children}</span>
      </M.Button>
    </ZipDownloadForm>
  )
}
