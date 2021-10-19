import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import Thumbnail from 'components/Thumbnail'

const useStyles = M.makeStyles({
  root: {
    display: 'block',
    margin: 'auto',
    maxWidth: '100%',
  },
})

function Image({ handle, className, ...props }) {
  const classes = useStyles()
  return (
    <Thumbnail
      handle={handle}
      size="lg"
      className={cx(className, classes.root)}
      alt=""
      skeletonProps={{ width: '100%' }}
      {...props}
    />
  )
}

export default (img, props) => <Image {...img} {...props} />
