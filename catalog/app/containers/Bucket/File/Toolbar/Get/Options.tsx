import { basename } from 'path'

import * as React from 'react'
import * as M from '@material-ui/core'

import { Tabs } from 'components/Dialog'
import * as CodeSamples from 'containers/Bucket/CodeSamples'
import * as Buttons from 'containers/Bucket/Download/Buttons'

import type * as Toolbar from 'containers/Bucket/Toolbar'

const useFileCodeSamplesStyles = M.makeStyles((t) => ({
  code: {
    marginBottom: t.spacing(2),
  },
}))

interface FileCodeSamplesProps {
  className?: string
  bucket: string
  path: string
}

export function FileCodeSamples({ className, bucket, path }: FileCodeSamplesProps) {
  const classes = useFileCodeSamplesStyles()
  const apiDest = basename(path)
  const cliDest = ''
  const props = { className: classes.code, bucket, path }
  return (
    <div className={className}>
      <CodeSamples.Quilt3Fetch {...props} dest={apiDest} />
      <CodeSamples.CliFetch {...props} dest={cliDest} />
    </div>
  )
}

const useStyles = M.makeStyles((t) => ({
  download: {
    width: t.spacing(40),
  },
  code: {
    width: t.spacing(80),
  },
}))

interface GetOptionsProps {
  handle: Toolbar.FileHandle
  hideCode?: boolean
}

export default function GetOptions({ handle, hideCode }: GetOptionsProps) {
  const classes = useStyles()
  const download = React.useCallback(
    () => ({
      className: classes.download,
      label: 'Download',
      panel: <Buttons.DownloadFile fileHandle={handle} />,
    }),
    [classes.download, handle],
  )
  const code = React.useCallback(
    () => ({
      className: classes.code,
      label: 'Code',
      panel: <FileCodeSamples bucket={handle.bucket} path={handle.key} />,
    }),
    [classes.code, handle],
  )
  const tabs = React.useMemo(
    () => (hideCode ? [download()] : [download(), code()]),
    [code, download, hideCode],
  )
  return <Tabs>{tabs}</Tabs>
}
