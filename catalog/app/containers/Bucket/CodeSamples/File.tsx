import { basename } from 'path'

import dedent from 'dedent'
import * as React from 'react'

import { docs } from 'constants/urls'
import type * as Model from 'model'

import type { SectionProps } from '../Section'

import Code from './Code'

const TEMPLATES = {
  PY: ({ bucket, key }: Model.S3.S3ObjectLocation) =>
    dedent`
      import quilt3 as q3
      b = q3.Bucket("s3://${bucket}")
      # Download [[${docs}/api-reference/bucket#bucket.fetch]]
      b.fetch("${key}", "./${basename(key)}")
    `,
  CLI: ({ bucket, key }: Model.S3.S3ObjectLocation) =>
    dedent`
      # Download [[https://docs.aws.amazon.com/cli/latest/reference/s3/cp.html]]
      aws s3 cp "s3://${bucket}/${key}" .
    `,
}

interface FileCodeSamplesProps extends Partial<SectionProps> {
  location: Model.S3.S3ObjectLocation
}

export default function FileCodeSamples({ location, ...props }: FileCodeSamplesProps) {
  const code = React.useMemo(
    () => [
      {
        label: 'Python',
        hl: 'python',
        contents: TEMPLATES.PY(location),
      },
      {
        label: 'CLI',
        hl: 'bash',
        contents: TEMPLATES.CLI(location),
      },
    ],
    [location],
  )
  return <Code {...props}>{code}</Code>
}
