import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'
import { fade } from '@material-ui/core/styles'

const shimmerSize = '200px'

const useStyles = M.makeStyles((t) => ({
  '@keyframes wave': {
    '0%': {
      backgroundPosition: `-${shimmerSize} 0`,
    },
    '100%': {
      backgroundPosition: `calc(${shimmerSize} + 100%) 0`,
    },
  },
  root: {
    animation: '$wave 3s infinite',
    backgroundColor: t.palette.action.hover,
    backgroundImage: `linear-gradient(
      90deg,
      ${fade(t.palette.common.white, 0)},
      ${fade(t.palette.common.white, 0.7)},
      ${fade(t.palette.common.white, 0)}
    )`,
    backgroundRepeat: 'no-repeat',
    backgroundSize: `${shimmerSize} 100%`,
  },
}))

export default React.forwardRef(function Skeleton({ className, ...props }, ref) {
  const classes = useStyles()
  return <M.Box className={cx(className, classes.root)} {...props} ref={ref} />
})
