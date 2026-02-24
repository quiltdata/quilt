import { basename } from 'path'

import * as React from 'react'
import * as M from '@material-ui/core'
import * as Icons from '@material-ui/icons'

import * as CodeSamples from 'containers/Bucket/CodeSamples'
import * as Buttons from 'containers/Bucket/Download/Buttons'
import GetOptions from 'containers/Bucket/Toolbar/GetOptions'
import * as AWS from 'utils/AWS'

import type * as Toolbar from 'containers/Bucket/Toolbar'
import type { Features } from '../useFeatures'

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
    marginBottom: t.spacing(1),
  },
  main: {
    flexGrow: 1,
    justifyContent: 'flex-start',
  },
}))

interface OptionsProps {
  handle: Toolbar.FileHandle
  features: Exclude<Features['get'], false>
}

export default function Options({ handle, features }: OptionsProps) {
  const classes = useStyles()
  const feedback = Buttons.useDownloadFeedback()
  const url = AWS.Signer.useDownloadUrl(handle)
  const download = (
    <Buttons.SplitCopyButton
      copyUri={`s3://${handle.bucket}/${handle.key}`}
      className={classes.download}
    >
      <M.Button
        className={classes.main}
        download
        href={url}
        startIcon={<Icons.ArrowDownwardOutlined />}
        {...feedback}
      >
        Download file
      </M.Button>
    </Buttons.SplitCopyButton>
  )
  const code = features.code ? (
    <FileCodeSamples bucket={handle.bucket} path={handle.key} />
  ) : undefined

  return <GetOptions download={download} code={code} />
}
