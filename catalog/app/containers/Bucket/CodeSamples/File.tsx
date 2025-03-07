import { basename } from 'path'

import dedent from 'dedent'
import * as React from 'react'
import * as M from '@material-ui/core'

import { docs } from 'constants/urls'

import Code from './Code'

const useStyles = M.makeStyles((t) => ({
  code: {
    '& + &': {
      marginTop: t.spacing(2),
    },
  },
}))

const TEMPLATES = {
  PY: (bucket: string, path: string) =>
    dedent`
      import quilt3 as q3
      b = q3.Bucket("s3://${bucket}")
      # Download [[${docs}/quilt-python-sdk-developers/api-reference/bucket#bucket.fetch]]
      b.fetch("${path}", "./${basename(path)}")
    `,
  CLI: (bucket: string, path: string) =>
    dedent`
      # Download [[https://docs.aws.amazon.com/cli/latest/reference/s3/cp.html]]
      aws s3 cp "s3://${bucket}/${path}" .
    `,
}

interface FileCodeSamplesProps {
  bucket: string
  path: string
}

export default function FileCodeSamples({ bucket, path }: FileCodeSamplesProps) {
  const classes = useStyles()
  const code = React.useMemo(
    () => [
      {
        label: 'Download using Quilt3 Python API',
        hl: 'python',
        contents: TEMPLATES.PY(bucket, path),
      },
      {
        label: 'Download using AWS SDK CLI',
        hl: 'bash',
        contents: TEMPLATES.CLI(bucket, path),
      },
    ],
    [bucket, path],
  )
  return (
    <div>
      {code.map((c) => (
        <Code key={c.hl} className={classes.code}>
          {c}
        </Code>
      ))}
    </div>
  )
}
