import { basename } from 'path'

import dedent from 'dedent'
import * as React from 'react'

import { docs } from 'constants/urls'

import Code from '../Code'
import type { SectionProps } from '../Section'

interface FileCodeSamplesProps extends Partial<SectionProps> {
  bucket: string
  path: string
}

export default function FileCodeSamples({
  bucket,
  path,
  ...props
}: FileCodeSamplesProps) {
  const code = React.useMemo(
    () => [
      {
        label: 'Python',
        hl: 'python',
        contents: dedent`
          import quilt3 as q3
          b = q3.Bucket("s3://${bucket}")
          # Download [[${docs}/api-reference/bucket#bucket.fetch]]
          b.fetch("${path}", "./${basename(path)}")
        `,
      },
      {
        label: 'CLI',
        hl: 'bash',
        contents: dedent`
          # Download [[https://docs.aws.amazon.com/cli/latest/reference/s3/cp.html]]
          aws s3 cp "s3://${bucket}/${path}" .
        `,
      },
    ],
    [bucket, path],
  )
  return <Code {...props}>{code}</Code>
}
