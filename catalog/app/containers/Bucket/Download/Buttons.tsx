import * as React from 'react'
import * as M from '@material-ui/core'
import {
  ArrowDownwardOutlined as IconArrowDownwardOutlined,
  ArchiveOutlined as IconArchiveOutlined,
} from '@material-ui/icons'

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
  return (
    <M.Button
      className={classes.root}
      download
      href={url}
      startIcon={<IconArrowDownwardOutlined />}
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
        startIcon={<IconArchiveOutlined />}
        type="submit"
        {...props}
      >
        <span>{children}</span>
      </M.Button>
    </ZipDownloadForm>
  )
}
