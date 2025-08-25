import * as React from 'react'
import * as M from '@material-ui/core'

import { Tabs } from 'components/Dialog'
import * as Buttons from 'containers/Bucket/Download/Buttons' // TODO: move to this dir

import type { FileHandle } from '../types'

import { FileCodeSamples } from './BucketCodeSamples'

const useStyles = M.makeStyles((t) => ({
  download: {
    width: t.spacing(40),
  },
  code: {
    width: t.spacing(80),
  },
}))

interface BucketFileOptionsProps {
  handle: FileHandle
  hideCode?: boolean
}

export default function BucketFileOptions({ handle, hideCode }: BucketFileOptionsProps) {
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
