import { basename } from 'path'

import dedent from 'dedent'
import * as React from 'react'

import { docs } from 'constants/urls'

import type { SectionProps } from '../Section'

import Code from './Code'

const TEMPLATES = {
  PY_INIT: (bucket: string) =>
    dedent`
      import quilt3 as q3
      b = q3.Bucket("s3://${bucket}")
    `,
  PY_DOWNLOAD: (path: string, dest: string) => {
    const pyDest = dest || basename(path)
    return dedent`
      # Download [[${docs}/api-reference/bucket#bucket.fetch]]
      b.fetch("${path}", "./${pyDest}")
    `
  },
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
  CLI_DOWNLOAD: (bucket: string, path: string, dest: string) => {
    const cliDest = dest ? `"./${dest}"` : '.'
    const recursiveFlag = dest ? ` --recursive` : ''
    return dedent`
      # Download [[https://docs.aws.amazon.com/cli/latest/reference/s3/cp.html]]
      aws s3 cp${recursiveFlag} "s3://${bucket}/${path}" ${cliDest}
    `
  },
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
  const dest = path ? basename(path) : bucket
  const code = React.useMemo(
    () => [
      {
        label: 'Python',
        hl: 'python',
        contents: [
          TEMPLATES.PY_INIT(bucket),
          isDirectory ? TEMPLATES.PY_LIST(path) : '',
          TEMPLATES.PY_DOWNLOAD(path, isDirectory ? dest : ''),
        ]
          .filter(Boolean)
          .join('\n'),
      },
      {
        label: 'CLI',
        hl: 'bash',
        contents: [
          isDirectory ? TEMPLATES.CLI_LIST(bucket, path) : '',
          TEMPLATES.CLI_DOWNLOAD(bucket, path, isDirectory ? dest : ''),
        ]
          .filter(Boolean)
          .join('\n'),
      },
    ],
    [isDirectory, bucket, path, dest],
  )
  return <Code {...props}>{code}</Code>
}
