import { basename } from 'path'

import * as React from 'react'
import * as M from '@material-ui/core'

import { Tabs } from 'components/Dialog'
import * as CodeSamples from 'containers/Bucket/CodeSamples'
import * as Buttons from 'containers/Bucket/Download/Buttons'
import type * as Toolbar from 'containers/Bucket/Toolbar'

const useCodeSamplesStyles = M.makeStyles((t) => ({
  code: {
    marginBottom: t.spacing(2),
  },
}))

interface DirCodeSamplesProps {
  className?: string
  bucket: string
  path: string
}

function DirCodeSamples({ className, bucket, path }: DirCodeSamplesProps) {
  const classes = useCodeSamplesStyles()
  const dest = path ? basename(path) : bucket
  const props = { className: classes.code, bucket, path }
  return (
    <div className={className}>
      <CodeSamples.Quilt3List {...props} />
      <CodeSamples.Quilt3Fetch {...props} dest={dest} />
      <CodeSamples.CliList {...props} />
      <CodeSamples.CliFetch {...props} dest={dest} />
    </div>
  )
}

interface DownloadDirProps {
  dirHandle: Toolbar.DirHandle
}

function DownloadDir({ dirHandle }: DownloadDirProps) {
  return (
    <Buttons.DownloadDir suffix={`dir/${dirHandle.bucket}/${dirHandle.path}`}>
      Download ZIP (directory)
    </Buttons.DownloadDir>
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

interface BucketOptionsProps {
  handle: Toolbar.DirHandle
  hideCode?: boolean
}

export default function BucketDirOptions({ handle, hideCode }: BucketOptionsProps) {
  const classes = useStyles()
  const download = React.useCallback(
    () => ({
      className: classes.download,
      label: 'Download',
      panel: <DownloadDir dirHandle={handle} />,
    }),
    [classes.download, handle],
  )
  const code = React.useCallback(
    () => ({
      className: classes.code,
      label: 'Code',
      panel: <DirCodeSamples bucket={handle.bucket} path={handle.path} />,
    }),
    [classes.code, handle],
  )
  const tabs = React.useMemo(
    () => (hideCode ? [download()] : [download(), code()]),
    [code, download, hideCode],
  )
  return <Tabs>{tabs}</Tabs>
}
