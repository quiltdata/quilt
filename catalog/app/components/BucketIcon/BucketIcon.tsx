import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import bucketIcon from './bucket.svg'

const useStyles = M.makeStyles((t) => ({
  root: {
    flexShrink: 0,
  },
  sizeSmall: {
    height: t.spacing(4),
    width: t.spacing(4),
  },
  sizeMedium: {
    height: t.spacing(5),
    width: t.spacing(5),
  },
  sizeLarge: {
    // NOTE: it isn't used now, adjust to your needs
    height: t.spacing(6),
    width: t.spacing(6),
  },
}))

interface BucketIconProps
  extends React.DetailedHTMLProps<
    React.ImgHTMLAttributes<HTMLImageElement>,
    HTMLImageElement
  > {
  className?: string
  alt: string
  size?: 'small' | 'medium' | 'large'
}

export default function BucketIcon({
  alt,
  className,
  size = 'medium',
  ...props
}: BucketIconProps) {
  const classes = useStyles()

  const sizeClass = {
    small: classes.sizeSmall,
    medium: classes.sizeMedium,
    large: classes.sizeLarge,
  }[size]

  return (
    <img
      alt={alt}
      src={bucketIcon}
      className={cx(classes.root, sizeClass, className)}
      {...props}
    />
  )
}
