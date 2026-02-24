import { basename } from 'path'

import * as React from 'react'
import * as M from '@material-ui/core'
import * as Icons from '@material-ui/icons'

import * as CodeSamples from 'containers/Bucket/CodeSamples'
import * as Buttons from 'containers/Bucket/Download/Buttons'
import { ZipDownloadForm } from 'containers/Bucket/FileView'
import GetOptions from 'containers/Bucket/Toolbar/GetOptions'
import type * as Toolbar from 'containers/Bucket/Toolbar'
import type { Features } from '../useFeatures'

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

const useDownloadDirStyles = M.makeStyles((t) => ({
  root: {
    marginBottom: t.spacing(1),
  },
  main: {
    flexGrow: 1,
    flexShrink: 0,
    justifyContent: 'flex-start',
  },
}))

interface DownloadDirProps {
  dirHandle: Toolbar.DirHandle
}

function DownloadDir({ dirHandle }: DownloadDirProps) {
  // TODO: pass selection to Buttons.DownloadDir
  const classes = useDownloadDirStyles()
  const feedback = Buttons.useDownloadFeedback()
  return (
    <ZipDownloadForm
      className={classes.root}
      suffix={`dir/${dirHandle.bucket}/${dirHandle.path}`}
    >
      <Buttons.SplitCopyButton copyUri={`s3://${dirHandle.bucket}/${dirHandle.path}`}>
        <M.Button
          className={classes.main}
          startIcon={<Icons.ArchiveOutlined />}
          type="submit"
          {...feedback}
        >
          Download ZIP (directory)
        </M.Button>
      </Buttons.SplitCopyButton>
    </ZipDownloadForm>
  )
}

interface OptionsProps {
  handle: Toolbar.DirHandle
  features: Exclude<Features['get'], false>
}

export default function Options({ handle, features }: OptionsProps) {
  const download = <DownloadDir dirHandle={handle} />
  const code = features.code ? (
    <DirCodeSamples bucket={handle.bucket} path={handle.path} />
  ) : undefined

  return <GetOptions download={download} code={code} />
}
