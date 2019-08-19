import * as React from 'react'
import * as M from '@material-ui/core'

import q from './q.png'
import quilt from './quilt.png'

const HEIGHT_Q = 27
const HEIGHT_QUILT = 29

export default ({ responsive = false, ...props }) => {
  const t = M.useTheme()
  const xs = M.useMediaQuery(t.breakpoints.down('xs'))
  const img =
    responsive && xs ? { height: HEIGHT_Q, src: q } : { height: HEIGHT_QUILT, src: quilt }
  return <M.Box component="img" alt="Quilt" {...img} {...props} />
}
