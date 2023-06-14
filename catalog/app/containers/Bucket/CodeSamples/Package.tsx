import dedent from 'dedent'

import * as R from 'ramda'
import * as React from 'react'

import { docs } from 'constants/urls'
import * as PackageUri from 'utils/PackageUri'
import * as s3paths from 'utils/s3paths'

import Code from '../Code'

interface PackageCodeSamplesProps {
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
}: PackageCodeSamplesProps) {
  const pathCli = path && ` --path "${s3paths.ensureNoSlash(path)}"`
  const pathPy = path && `, path="${s3paths.ensureNoSlash(path)}"`
  const hashDisplay = hashOrTag === 'latest' ? '' : R.take(10, hash)
  const hashPy = hashDisplay && `, top_hash="${hashDisplay}"`
  const hashCli = hashDisplay && ` --top-hash ${hashDisplay}`
  const code = [
    {
      label: 'Python',
      hl: 'python',
      contents: dedent`
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
      `,
    },
    {
      label: 'CLI',
      hl: 'bash',
      contents:
        dedent`
          # Download package [[${docs}/api-reference/cli#install]]
          quilt3 install "${name}"${pathCli}${hashCli} --registry s3://${bucket} --dest .
        ` +
        (!path
          ? dedent`\n
              # Upload package [[${docs}/api-reference/cli#push]]
              echo "Hello World" > README.md
              quilt3 push "${name}" --registry s3://${bucket} --dir .
            `
          : ''),
    },
    {
      label: 'URI',
      contents: PackageUri.stringify({ bucket, name, hash, path }),
    },
  ]
  return <Code>{code}</Code>
}
