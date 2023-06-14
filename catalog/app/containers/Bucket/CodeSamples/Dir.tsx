import { basename } from 'path'

import dedent from 'dedent'
import * as React from 'react'

import { docs } from 'constants/urls'

import Code from '../Code'
import type { SectionProps } from '../Section'

const TEMPLATES = {
  PY_INIT: (bucket: string) =>
    dedent`
      import quilt3 as q3
      b = q3.Bucket("s3://${bucket}")
    `,
  PY_DOWNLOAD: (path: string, dest: string) =>
    dedent`
      # Download [[${docs}/api-reference/bucket#bucket.fetch]]
      b.fetch("${path}", "./${dest}")
    `,
  PY_LIST: (path: string) =>
    dedent`
      # List files [[${docs}/api-reference/bucket#bucket.ls]]
      b.ls("${path}")
    `,
  CLI_LIST: (bucket: string, path: string) =>
    dedent`
      # List files [[https://docs.aws.amazon.com/cli/latest/reference/s3/ls.html]]
      aws s3 ls "s3://${bucket}/${path}"
    `,
  CLI_DOWNLOAD: (bucket: string, path: string, dest: string) =>
    dedent`
      # Download [[https://docs.aws.amazon.com/cli/latest/reference/s3/cp.html]]
      aws s3 cp --recursive "s3://${bucket}/${path}" ${dest}
    `,
}

interface DirCodeSamplesProps extends Partial<SectionProps> {
  bucket: string
  path: string
  isDirectory: boolean
}

export default function DirCodeSamples({
  bucket,
  path,
  isDirectory,
  ...props
}: DirCodeSamplesProps) {
  const dest = isDirectory ? (path ? basename(path) : bucket) : ''
  const pyDest = isDirectory ? dest : basename(path)
  const cliDest = isDirectory ? `"./${dest}"` : '.'
  const code = React.useMemo(
    () => [
      {
        label: 'Python',
        hl: 'python',
        contents: [
          TEMPLATES.PY_INIT(bucket),
          isDirectory ? TEMPLATES.PY_LIST(path) : '',
          TEMPLATES.PY_DOWNLOAD(path, pyDest),
        ]
          .filter(Boolean)
          .join('\n'),
      },
      {
        label: 'CLI',
        hl: 'bash',
        contents: [
          isDirectory ? TEMPLATES.CLI_LIST(bucket, path) : '',
          TEMPLATES.CLI_DOWNLOAD(bucket, path, cliDest),
        ]
          .filter(Boolean)
          .join('\n'),
      },
    ],
    [isDirectory, bucket, path, pyDest, cliDest],
  )
  return <Code {...props}>{code}</Code>
}
