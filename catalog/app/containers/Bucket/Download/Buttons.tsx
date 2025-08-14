import * as React from 'react'
import * as M from '@material-ui/core'

import type * as Model from 'model'
import * as AWS from 'utils/AWS'

import { ZipDownloadForm } from '../FileView'

const useDownloadButtonStyles = M.makeStyles(() => ({
  root: {
    justifyContent: 'flex-start',
    width: '100%',
  },
}))

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
      startIcon={<M.Icon>arrow_downward</M.Icon>}
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

export function DownloadDir({ children, fileHandles, ...props }: DownloadDirProps) {
  const classes = useDownloadButtonStyles()
  const files = React.useMemo(
    () => fileHandles && fileHandles.map(({ key }) => key),
    [fileHandles],
  )
  return (
    <ZipDownloadForm files={files} {...props}>
      <M.Button
        className={classes.root}
        startIcon={<M.Icon>archive</M.Icon>}
        type="submit"
      >
        {children}
      </M.Button>
    </ZipDownloadForm>
  )
}
