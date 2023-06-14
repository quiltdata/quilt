import dedent from 'dedent'

import * as R from 'ramda'
import * as React from 'react'

import { docs } from 'constants/urls'
import * as PackageUri from 'utils/PackageUri'
import * as s3paths from 'utils/s3paths'

import Code from '../Code'
import type { SectionProps } from '../Section'

const TEMPLATES = {
  PY: (bucket: string, name: string, path: string, hashDisplay: string) => {
    const pathPy = path && `, path="${s3paths.ensureNoSlash(path)}"`
    const hashPy = hashDisplay && `, top_hash="${hashDisplay}"`
    return dedent`
      import quilt3 as q3
      # Browse [[${docs}/api-reference/package#package.browse]]
      p = q3.Package.browse("${name}"${hashPy}, registry="s3://${bucket}")
      # make changes to package adding individual files [[${docs}/api-reference/package#package.set]]
      p.set("data.csv", "data.csv")
      # or whole directories [[${docs}/api-reference/package#package.set_dir]]
      p.set_dir("subdir", "subdir")
      # and push changes [[${docs}/api-reference/package#package.push]]
      p.push("${name}", registry="s3://${bucket}", message="Hello World")

      # Download (be mindful of large packages) [[${docs}/api-reference/package#package.push]]
      q3.Package.install("${name}"${pathPy}${hashPy}, registry="s3://${bucket}", dest=".")
    `
  },
  CLI_DOWNLOAD: (bucket: string, name: string, path: string, hashDisplay: string) => {
    const pathCli = path && ` --path "${s3paths.ensureNoSlash(path)}"`
    const hashCli = hashDisplay && ` --top-hash ${hashDisplay}`
    return dedent`
      # Download package [[${docs}/api-reference/cli#install]]
      quilt3 install "${name}"${pathCli}${hashCli} --registry s3://${bucket} --dest .
    `
  },
  CLI_UPLOAD: (bucket: string, name: string) =>
    dedent`
      # Upload package [[${docs}/api-reference/cli#push]]
      echo "Hello World" > README.md
      quilt3 push "${name}" --registry s3://${bucket} --dir .
    `,
}

interface PackageCodeSamplesProps extends Partial<SectionProps> {
  bucket: string
  name: string
  hash: string
  hashOrTag: string
  path: string
}

export default function PackageCodeSamples({
  bucket,
  name,
  hash,
  hashOrTag,
  path,
  ...props
}: PackageCodeSamplesProps) {
  const hashDisplay = hashOrTag === 'latest' ? '' : R.take(10, hash)
  const code = React.useMemo(
    () => [
      {
        label: 'Python',
        hl: 'python',
        contents: TEMPLATES.PY(bucket, name, path, hashDisplay),
      },
      {
        label: 'CLI',
        hl: 'bash',
        contents: [
          TEMPLATES.CLI_DOWNLOAD(bucket, name, path, hashDisplay),
          !path ? TEMPLATES.CLI_UPLOAD(bucket, name) : '',
        ]
          .filter(Boolean)
          .join('\n\n'),
      },
      {
        label: 'URI',
        contents: PackageUri.stringify({ bucket, name, hash, path }),
      },
    ],
    [bucket, name, hashDisplay, hash, path],
  )
  return <Code {...props}>{code}</Code>
}
