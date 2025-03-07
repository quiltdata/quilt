import dedent from 'dedent'

import * as R from 'ramda'
import * as React from 'react'
import * as M from '@material-ui/core'

import { docs } from 'constants/urls'
import * as s3paths from 'utils/s3paths'

import Code from './Code'

const useStyles = M.makeStyles((t) => ({
  code: {
    '& + &': {
      marginTop: t.spacing(2),
    },
  },
}))

// TODO: use markdown templates + prism code highlighter + autolinker plugin

const TEMPLATES = {
  PY: (bucket: string, name: string, path: string, hashDisplay: string) => {
    const pathPy = path && `, path="${s3paths.ensureNoSlash(path)}"`
    const hashPy = hashDisplay && `, top_hash="${hashDisplay}"`
    return dedent`
      import quilt3 as q3
      # Browse [[${docs}/quilt-python-sdk-developers/api-reference/package#package.browse]]
      p = q3.Package.browse("${name}"${hashPy}, registry="s3://${bucket}")
      # make changes to package adding individual files [[${docs}/quilt-python-sdk-developers/api-reference/package#package.set]]
      p.set("data.csv", "data.csv")
      # or whole directories [[${docs}/quilt-python-sdk-developers/api-reference/package#package.set_dir]]
      p.set_dir("subdir", "subdir")
      # and push changes [[${docs}/quilt-python-sdk-developers/api-reference/package#package.push]]
      p.push("${name}", registry="s3://${bucket}", message="Hello World")

      # Download (be mindful of large packages) [[${docs}/quilt-python-sdk-developers/api-reference/package#package.install]]
      q3.Package.install("${name}"${pathPy}${hashPy}, registry="s3://${bucket}", dest=".")
    `
  },
  CLI_DOWNLOAD: (bucket: string, name: string, path: string, hashDisplay: string) => {
    const pathCli = path && ` --path "${s3paths.ensureNoSlash(path)}"`
    const hashCli = hashDisplay && ` --top-hash ${hashDisplay}`
    return dedent`
      # Download package [[${docs}/quilt-python-sdk-developers/api-reference/cli#install]]
      quilt3 install "${name}"${pathCli}${hashCli} --registry s3://${bucket} --dest .
    `
  },
  CLI_UPLOAD: (bucket: string, name: string) =>
    dedent`
      # Upload package [[${docs}/quilt-python-sdk-developers/api-reference/cli#push]]
      echo "Hello World" > README.md
      quilt3 push "${name}" --registry s3://${bucket} --dir .
    `,
}

interface PackageCodeSamplesProps {
  className?: string
  bucket: string
  name: string
  hash: string
  hashOrTag: string
  path: string
}

export default function PackageCodeSamples({
  className,
  bucket,
  name,
  hash,
  hashOrTag,
  path,
}: PackageCodeSamplesProps) {
  const classes = useStyles()
  const hashDisplay = hashOrTag === 'latest' ? '' : R.take(10, hash)
  const code = React.useMemo(
    () => [
      {
        label: 'Install using Quilt3 Python API',
        hl: 'python',
        contents: TEMPLATES.PY(bucket, name, path, hashDisplay),
      },
      {
        label: 'Install using Quilt3 CLI',
        hl: 'bash',
        contents: [
          TEMPLATES.CLI_DOWNLOAD(bucket, name, path, hashDisplay),
          !path ? TEMPLATES.CLI_UPLOAD(bucket, name) : '',
        ]
          .filter(Boolean)
          .join('\n\n'),
      },
    ],
    [bucket, name, hashDisplay, path],
  )

  return (
    <div className={className}>
      {code.map((c) => (
        <Code key={c.hl} className={classes.code}>
          {c}
        </Code>
      ))}
    </div>
  )
}
