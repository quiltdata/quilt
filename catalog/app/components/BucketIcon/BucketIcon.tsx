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

interface BucketIconStubProps
  extends React.DetailedHTMLProps<
    React.ImgHTMLAttributes<HTMLImageElement>,
    HTMLImageElement
  > {
  className?: string
  alt: string
  size?: 'small' | 'medium' | 'large'
}

function BucketIconStub({
  alt,
  className,
  size = 'medium',
  ...props
}: BucketIconStubProps) {
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

interface BucketIconProps extends BucketIconStubProps {
  classes?: {
    custom?: string
    stub?: string
  }
  src: string
}

export default function BucketIcon({
  alt,
  className,
  classes,
  size,
  src,
  ...props
}: BucketIconProps) {
  if (!src) {
    return (
      <BucketIconStub
        alt={alt}
        className={cx(className, classes?.stub)}
        size={size}
        {...props}
      />
    )
  }

  return <img className={cx(className, classes?.custom)} src={src} alt="" />
}
