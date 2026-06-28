import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import type { S3ObjectLocation } from 'model/S3'
import Thumbnail from 'components/Thumbnail'

const useStyles = M.makeStyles({
  root: {
    display: 'block',
    margin: 'auto',
    maxWidth: '100%',
  },
})

interface ImageEssential {
  handle: S3ObjectLocation
}

interface ImageProps extends ImageEssential, React.HTMLAttributes<HTMLElement> {
  className?: string
}

function Image({ handle, className, ...props }: ImageProps) {
  const classes = useStyles()
  return (
    <Thumbnail
      handle={handle}
      size="lg"
      className={cx(className, classes.root)}
      alt=""
      {...props}
    />
  )
}

export default (img: ImageEssential, props?: React.HTMLAttributes<HTMLElement>) => (
  <Image {...img} {...props} />
)
