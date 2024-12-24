import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import bucketIcon from './bucket.svg'

const useStyles = M.makeStyles((t) => ({
  root: {
    height: t.spacing(4),
    width: t.spacing(4),
  },
}))

interface BucketIconProps
  extends React.DetailedHTMLProps<
    React.ImgHTMLAttributes<HTMLImageElement>,
    HTMLImageElement
  > {
  alt: string
  className?: string
  classes?: {
    custom?: string
    stub?: string
  }
  src: string
}

export default function BucketIcon({
  alt,
  className: optClassName,
  classes: optClasses,
  src,
  ...props
}: BucketIconProps) {
  const classes = useStyles()

  const className = src
    ? cx(classes.root, optClasses?.custom, optClassName)
    : cx(classes.root, optClasses?.stub, optClassName)

  return <img alt={alt} className={className} src={src || bucketIcon} {...props} />
}
