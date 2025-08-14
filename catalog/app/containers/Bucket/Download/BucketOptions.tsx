import * as React from 'react'
import * as M from '@material-ui/core'

import { Tabs } from 'components/Dialog'
import type * as Model from 'model'

import { DirCodeSamples, FileCodeSamples } from './BucketCodeSamples'
import * as Buttons from './Buttons'

type FileHandle = Model.S3.S3ObjectLocation
type DirHandle = { bucket: string; path: string }
type Handle = FileHandle | DirHandle

function isFile(handle: Handle): handle is FileHandle {
  return 'key' in handle && !!handle.key
}

interface DownloadDirProps {
  dirHandle: DirHandle
}

function DownloadDir({ dirHandle }: DownloadDirProps) {
  return (
    <Buttons.DownloadDir suffix={`dir/${dirHandle.bucket}/${dirHandle.path}`}>
      Download ZIP (directory)
    </Buttons.DownloadDir>
  )
}

interface DownloadPanelProps {
  handle: Handle
}

function DownloadPanel({ handle }: DownloadPanelProps) {
  return isFile(handle) ? (
    <Buttons.DownloadFile fileHandle={handle} />
  ) : (
    <DownloadDir dirHandle={handle} />
  )
}

interface CodePanelProps {
  handle: Handle
}

function CodePanel({ handle }: CodePanelProps) {
  return isFile(handle) ? (
    <FileCodeSamples bucket={handle.bucket} path={handle.key} />
  ) : (
    <DirCodeSamples bucket={handle.bucket} path={handle.path} />
  )
}

const useOptionsStyles = M.makeStyles((t) => ({
  download: {
    width: t.spacing(40),
  },
  code: {
    width: t.spacing(80),
  },
}))

interface OptionsProps {
  handle: Handle
  hideCode?: boolean
}

export default function Options({ handle, hideCode }: OptionsProps) {
  const classes = useOptionsStyles()
  const download = React.useCallback(
    () => ({
      className: classes.download,
      label: 'Download',
      panel: <DownloadPanel handle={handle} />,
    }),
    [classes.download, handle],
  )
  const code = React.useCallback(
    () => ({
      className: classes.code,
      label: 'Code',
      panel: <CodePanel handle={handle} />,
    }),
    [classes.code, handle],
  )
  const tabs = React.useMemo(
    () => (hideCode ? [download()] : [download(), code()]),
    [code, download, hideCode],
  )
  return <Tabs>{tabs}</Tabs>
}
