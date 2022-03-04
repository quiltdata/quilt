import * as React from 'react'
import * as M from '@material-ui/core'

import q from './q.png'
import quilt from './quilt.png'

const HEIGHT_Q = 27
const HEIGHT_QUILT = 29

interface LogoProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  responsive?: boolean
  forcedShort?: boolean
}

export default function Logo({
  responsive = false,
  forcedShort = false,
  src,
  ...props
}: LogoProps) {
  const t = M.useTheme()
  const xs = M.useMediaQuery(t.breakpoints.down('xs'))
  const short = forcedShort || (responsive && xs)
  const imgProps = short
    ? { height: HEIGHT_Q, src: src || q }
    : { height: HEIGHT_QUILT, src: src || quilt }
  return <img alt="Quilt" {...imgProps} {...props} />
}
