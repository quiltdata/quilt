import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import Skeleton from 'components/Skeleton'

const useStyles = M.makeStyles((t) => ({
  root: {
    borderRadius: '4px',
    boxShadow: t.shadows[4],
    display: 'inline-flex',
    verticalAlign: 'middle',
    width: t.spacing(15),
  },
  small: {
    height: t.spacing(3.75),
  },
  medium: {
    height: t.spacing(4.5),
  },
  large: {
    height: t.spacing(5),
  },
}))

interface ButtonSkeletonProps {
  className?: string
  size?: 'small' | 'medium' | 'large'
}

export default function ButtonSkeleton({
  className,
  size = 'medium',
}: ButtonSkeletonProps) {
  const classes = useStyles()
  return <Skeleton className={cx(classes.root, classes[size], className)} />
}
