import dedent from 'dedent'

import * as R from 'ramda'
import * as React from 'react'

import { docs } from 'constants/urls'
import type * as Model from 'model'
import * as PackageUri from 'utils/PackageUri'
import * as s3paths from 'utils/s3paths'

import type { SectionProps } from '../Section'

import Code from './Code'

const TEMPLATES = {
  PY: ({ bucket, name }: Model.Package.Handle, path: string, hashDisplay: string) => {
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
  CLI_DOWNLOAD: (
    { bucket, name }: Model.Package.Handle,
    path: string,
    hashDisplay: string,
  ) => {
    const pathCli = path && ` --path "${s3paths.ensureNoSlash(path)}"`
    const hashCli = hashDisplay && ` --top-hash ${hashDisplay}`
    return dedent`
      # Download package [[${docs}/api-reference/cli#install]]
      quilt3 install "${name}"${pathCli}${hashCli} --registry s3://${bucket} --dest .
    `
  },
  CLI_UPLOAD: ({ bucket, name }: Model.Package.Handle) =>
    dedent`
      # Upload package [[${docs}/api-reference/cli#push]]
      echo "Hello World" > README.md
      quilt3 push "${name}" --registry s3://${bucket} --dir .
    `,
}

interface PackageCodeSamplesProps extends Partial<SectionProps> {
  handle: Model.Package.Handle
  hash: Model.Package.Hash
  path: string
}

export default function PackageCodeSamples({
  handle,
  hash,
  path,
  ...props
}: PackageCodeSamplesProps) {
  const hashDisplay = hash.alias === 'latest' ? '' : R.take(10, hash.value)
  const code = React.useMemo(
    () => [
      {
        label: 'Python',
        hl: 'python',
        contents: TEMPLATES.PY(handle, path, hashDisplay),
      },
      {
        label: 'CLI',
        hl: 'bash',
        contents: [
          TEMPLATES.CLI_DOWNLOAD(handle, path, hashDisplay),
          !path ? TEMPLATES.CLI_UPLOAD(handle) : '',
        ]
          .filter(Boolean)
          .join('\n\n'),
      },
      {
        label: 'URI',
        contents: PackageUri.stringify({ ...handle, hash: hash.value, path }),
      },
    ],
    [handle, hashDisplay, hash, path],
  )
  return <Code {...props}>{code}</Code>
}
