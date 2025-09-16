import * as React from 'react'

import { docs } from 'constants/urls'
import Code from 'containers/Bucket/Download/Code'

interface SampleProps {
  className: string
  bucket: string
  path: string
  dest?: string
}

interface FetchSampleProps extends SampleProps {
  dest: string
}

export function Quilt3List({ className, bucket, path }: SampleProps) {
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

export function Quilt3Fetch({ className, bucket, path, dest }: FetchSampleProps) {
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

export function CliFetch({ className, bucket, path, dest }: FetchSampleProps) {
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

export function CliList({ className, bucket, path }: SampleProps) {
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
