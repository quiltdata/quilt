import * as React from 'react'
import * as M from '@material-ui/core'

import { Tabs } from 'components/Dialog'
import * as Buttons from 'containers/Bucket/Download/Buttons' // TODO: move in this dir

import type { DirHandle } from '../types'

import { DirCodeSamples } from './BucketCodeSamples'

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

const useStyles = M.makeStyles((t) => ({
  download: {
    width: t.spacing(40),
  },
  code: {
    width: t.spacing(80),
  },
}))

interface BucketOptionsProps {
  handle: DirHandle
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
