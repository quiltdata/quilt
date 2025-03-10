import * as R from 'ramda'
import * as React from 'react'
import * as M from '@material-ui/core'

import { docs } from 'constants/urls'
import * as s3paths from 'utils/s3paths'

import Code from './Code'

const useStyles = M.makeStyles((t) => ({
  code: {
    marginBottom: t.spacing(2),
  },
}))

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
  const hashPy = hashDisplay && `, top_hash="${hashDisplay}"`
  const pathPy = path && `, path="${s3paths.ensureNoSlash(path)}"`
  const pathCli = path && ` --path "${s3paths.ensureNoSlash(path)}"`
  const hashCli = hashDisplay && ` --top-hash ${hashDisplay}`

  return (
    <div className={className}>
      <Code
        className={classes.code}
        label="Browse using Quilt3 Python API"
        hl="python"
        help={`${docs}/quilt-python-sdk-developers/api-reference/package#package.browse`}
        lines={[
          `import quilt3 as q3`,
          `q3.Package.browse("${name}"${hashPy}, registry="s3://${bucket}")`,
        ]}
      />

      <Code
        className={classes.code}
        label="Install using Quilt3 Python API"
        hl="python"
        help={`${docs}/quilt-python-sdk-developers/api-reference/package#package.install`}
        lines={[
          `import quilt3 as q3`,
          `q3.Package.install("${name}"${pathPy}${hashPy}, registry="s3://${bucket}", dest=".")`,
        ]}
      />
      <Code
        className={classes.code}
        label="Install using Quilt3 CLI"
        hl="bash"
        help={`${docs}/quilt-python-sdk/api-reference/cli#install`}
        lines={[
          `quilt3 install "${name}"${pathCli}${hashCli} --registry s3://${bucket} --dest .`,
        ]}
      />
    </div>
  )
}
