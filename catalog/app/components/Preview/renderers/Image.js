import cx from 'classnames'
import * as React from 'react'
import { withStyles } from '@material-ui/styles'

import Thumbnail from 'components/Thumbnail'
import * as RT from 'utils/reactTools'

const Image = RT.composeComponent(
  'Preview.renderers.Image',
  withStyles(() => ({
    root: {
      display: 'block',
      margin: 'auto',
      maxWidth: '100%',
    },
  })),
  ({ handle, classes, className, ...props }) => (
    <Thumbnail
      handle={handle}
      size="lg"
      className={cx(className, classes.root)}
      alt=""
      skeletonProps={{ width: '100%' }}
      {...props}
    />
  ),
)

export default (img, props) => <Image {...img} {...props} />
