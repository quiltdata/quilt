import { basename } from 'path'

import * as React from 'react'
import * as M from '@material-ui/core'

import * as CodeSamples from 'containers/Bucket/CodeSamples'
import * as Buttons from 'containers/Bucket/Download/Buttons'
import GetOptions from 'containers/Bucket/Toolbar/GetOptions'

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

interface OptionsProps {
  handle: Toolbar.FileHandle
  features: Exclude<Features['get'], false>
}

export default function Options({ handle, features }: OptionsProps) {
  const feedback = Buttons.useDownloadFeedback()
  const download = (
    <Buttons.DownloadFile
      fileHandle={handle}
      s3Uri={`s3://${handle.bucket}/${handle.key}`}
      {...feedback}
    />
  )
  const code = features.code ? (
    <FileCodeSamples bucket={handle.bucket} path={handle.key} />
  ) : undefined

  return <GetOptions download={download} code={code} />
}
