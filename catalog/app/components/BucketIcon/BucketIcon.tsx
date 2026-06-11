import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import bucketIcon from './bucket.svg'
import bucketIconWhite from './bucket-white.svg'

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
  // use the white default icon, for dark backgrounds
  contrast?: boolean
  src?: string
}

export default function BucketIcon({
  alt,
  className: optClassName,
  classes: optClasses,
  contrast = false,
  src,
  ...props
}: BucketIconProps) {
  const classes = useStyles()

  const className = src
    ? cx(classes.root, optClasses?.custom, optClassName)
    : cx(classes.root, optClasses?.stub, optClassName)

  const defaultIcon = contrast ? bucketIconWhite : bucketIcon

  return <img alt={alt} className={className} src={src || defaultIcon} {...props} />
}
