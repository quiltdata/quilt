import { basename } from 'path'

import * as React from 'react'
import * as M from '@material-ui/core'

import { docs } from 'constants/urls'

import Code from './Code'

interface SampleProps {
  className: string
  bucket: string
  path: string
  dest?: string
}

function Quilt3List({ className, bucket, path }: SampleProps) {
  return (
    <Code
      className={className}
      label="List files in a directory using Quilt3 Python API"
      hl="python"
      help={`${docs}/quilt-python-sdk-developers/api-reference/bucket#bucket.ls`}
      lines={[
        'import quilt3 as q3',
        `b = q3.Bucket("s3://${bucket}")`,
        `b.ls("${path}")`,
      ]}
    />
  )
}

function Quilt3Fetch({ className, bucket, path, dest }: SampleProps) {
  return (
    <Code
      className={className}
      label="Download using Quilt3 Python API"
      hl="python"
      help={`${docs}/quilt-python-sdk-developers/api-reference/bucket#bucket.fetch`}
      lines={[
        'import quilt3 as q3',
        `b = q3.Bucket("s3://${bucket}")`,
        `b.fetch("${path}", "./${dest}")`,
      ]}
    />
  )
}

function CliFetch({ className, bucket, path, dest }: SampleProps) {
  return (
    <Code
      className={className}
      label="Download using AWS CLI"
      hl="bash"
      help="https://docs.aws.amazon.com/cli/latest/reference/s3/cp.html"
      lines={[`aws s3 cp --recursive "s3://${bucket}/${path}" "./${dest}"`]}
    />
  )
}

function CliList({ className, bucket, path }: SampleProps) {
  return (
    <Code
      className={className}
      label="List files in a directory using AWS CLI"
      hl="bash"
      help="https://docs.aws.amazon.com/cli/latest/reference/s3/ls.html"
      lines={[`aws s3 ls "s3://${bucket}/${path}"`]}
    />
  )
}

const useStyles = M.makeStyles((t) => ({
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
  const classes = useStyles()
  const apiDest = basename(path)
  const cliDest = ''
  const props = { className: classes.code, bucket, path }
  return (
    <div className={className}>
      <Quilt3Fetch {...props} dest={apiDest} />
      <CliFetch {...props} dest={cliDest} />
    </div>
  )
}

interface DirCodeSamplesProps {
  className?: string
  bucket: string
  path: string
}

export function DirCodeSamples({ className, bucket, path }: DirCodeSamplesProps) {
  const classes = useStyles()
  const dest = path ? basename(path) : bucket
  const props = { className: classes.code, bucket, path }
  return (
    <div className={className}>
      <Quilt3List {...props} />
      <Quilt3Fetch {...props} dest={dest} />
      <CliList {...props} />
      <CliFetch {...props} dest={dest} />
    </div>
  )
}
