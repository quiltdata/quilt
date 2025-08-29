import { basename } from 'path'

import * as React from 'react'
import * as M from '@material-ui/core'

import * as CodeSamples from 'containers/Bucket/CodeSamples'
import * as Buttons from 'containers/Bucket/Download/Buttons'
import GetOptions from 'containers/Bucket/Toolbar/GetOptions'
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
  // TODO: pass selection to Buttons.DownloadDir
  const [downloading, setDownloading] = React.useState(false)
  React.useEffect(() => {
    if (!downloading) return
    setTimeout(() => setDownloading(false), 1000)
  }, [downloading])
  return (
    <Buttons.DownloadDir
      suffix={`dir/${dirHandle.bucket}/${dirHandle.path}`}
      onClick={(event) => {
        event.stopPropagation()
        setDownloading(true)
      }}
      {...(downloading
        ? {
            startIcon: <M.CircularProgress size={20} />,
          }
        : {})}
    >
      Download ZIP (directory)
    </Buttons.DownloadDir>
  )
}

interface OptionsProps {
  handle: Toolbar.DirHandle
  hideCode?: boolean
}

export default function Options({ handle, hideCode }: OptionsProps) {
  const download = <DownloadDir dirHandle={handle} />
  const code = hideCode ? undefined : (
    <DirCodeSamples bucket={handle.bucket} path={handle.path} />
  )

  return <GetOptions download={download} code={code} />
}
