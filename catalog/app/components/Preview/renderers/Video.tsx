import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import * as AWS from 'utils/AWS'
import { S3HandleBase } from 'utils/s3paths'

const useStyles = M.makeStyles({
  root: {
    display: 'block',
    margin: 'auto',
    maxWidth: '100%',
  },
})

interface VideoProps extends React.HTMLAttributes<HTMLVideoElement> {
  className?: string
  handle: S3HandleBase
}

function Video({ handle, className, ...props }: VideoProps) {
  const sign = AWS.Signer.useS3Signer()
  const classes = useStyles()
  const url = React.useMemo(() => sign(handle), [handle, sign])
  return (
    <video controls muted src={url} className={cx(className, classes.root)} {...props} />
  )
}

export default (img: VideoProps, props: VideoProps) => <Video {...img} {...props} />
