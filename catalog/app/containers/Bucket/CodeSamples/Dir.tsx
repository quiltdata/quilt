import { basename } from 'path'

import dedent from 'dedent'
import * as React from 'react'

import { docs } from 'constants/urls'

import type { SectionProps } from '../Section'

import Code from './Code'

const TEMPLATES = {
  PY: (bucket: string, path: string, dest: string) =>
    dedent`
      import quilt3 as q3
      b = q3.Bucket("s3://${bucket}")
      # List files [[${docs}/api-reference/bucket#bucket.ls]]
      b.ls("${path}")
      # Download [[${docs}/api-reference/bucket#bucket.fetch]]
      b.fetch("${path}", "./${dest}")
    `,
  CLI: (bucket: string, path: string, dest: string) =>
    dedent`
      # List files [[https://docs.aws.amazon.com/cli/latest/reference/s3/ls.html]]
      aws s3 ls "s3://${bucket}/${path}"
      # Download [[https://docs.aws.amazon.com/cli/latest/reference/s3/cp.html]]
      aws s3 cp --recursive "s3://${bucket}/${path}" "./${dest}"
    `,
}

interface DirCodeSamplesProps extends Partial<SectionProps> {
  bucket: string
  path: string
}

export default function DirCodeSamples({ bucket, path, ...props }: DirCodeSamplesProps) {
  const dest = path ? basename(path) : bucket
  const code = React.useMemo(
    () => [
      {
        label: 'Python',
        hl: 'python',
        contents: TEMPLATES.PY(bucket, path, dest),
      },
      {
        label: 'CLI',
        hl: 'bash',
        contents: TEMPLATES.CLI(bucket, path, dest),
      },
    ],
    [bucket, path, dest],
  )
  return <Code {...props}>{code}</Code>
}
