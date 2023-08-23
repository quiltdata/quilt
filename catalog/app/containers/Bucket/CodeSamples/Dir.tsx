import { basename } from 'path'

import dedent from 'dedent'
import * as React from 'react'

import { docs } from 'constants/urls'
import type * as Model from 'model'

import type { SectionProps } from '../Section'

import Code from './Code'

const TEMPLATES = {
  PY: ({ bucket, key }: Model.S3.S3ObjectLocation, dest: string) =>
    dedent`
      import quilt3 as q3
      b = q3.Bucket("s3://${bucket}")
      # List files [[${docs}/api-reference/bucket#bucket.ls]]
      b.ls("${key}")
      # Download [[${docs}/api-reference/bucket#bucket.fetch]]
      b.fetch("${key}", "./${dest}")
    `,
  CLI: ({ bucket, key }: Model.S3.S3ObjectLocation, dest: string) =>
    dedent`
      # List files [[https://docs.aws.amazon.com/cli/latest/reference/s3/ls.html]]
      aws s3 ls "s3://${bucket}/${key}"
      # Download [[https://docs.aws.amazon.com/cli/latest/reference/s3/cp.html]]
      aws s3 cp --recursive "s3://${bucket}/${key}" "./${dest}"
    `,
}

interface DirCodeSamplesProps extends Partial<SectionProps> {
  location: Model.S3.S3ObjectLocation
}

export default function DirCodeSamples({ location, ...props }: DirCodeSamplesProps) {
  const dest = location.key ? basename(location.key) : location.bucket
  const code = React.useMemo(
    () => [
      {
        label: 'Python',
        hl: 'python',
        contents: TEMPLATES.PY(location, dest),
      },
      {
        label: 'CLI',
        hl: 'bash',
        contents: TEMPLATES.CLI(location, dest),
      },
    ],
    [location, dest],
  )
  return <Code {...props}>{code}</Code>
}
