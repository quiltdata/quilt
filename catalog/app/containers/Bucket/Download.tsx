import * as React from 'react'

import * as Config from 'utils/Config'

import * as FileView from './FileView'

interface DownloadButtonProps {
  bucket: string
  className: string
  label?: string
  path?: string
}

export function DownloadButton({ bucket, className, label, path }: DownloadButtonProps) {
  const { noDownload }: { noDownload: boolean } = Config.use()

  if (noDownload) return null

  return (
    <FileView.ZipDownloadForm
      className={className}
      suffix={`dir/${bucket}/${path}`}
      label={label}
    />
  )
}
