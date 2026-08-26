import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'
import { fade } from '@material-ui/core/styles'

const shimmerSize = '200px'

const useStyles = M.makeStyles((t) => ({
  root: {
    background: t.palette.action.hover,
  },
  '@keyframes wave': {
    '0%': {
      backgroundPosition: `-${shimmerSize} 0`,
    },
    '100%': {
      backgroundPosition: `calc(${shimmerSize} + 100%) 0`,
    },
  },
  animate: {
    animation: '$wave 3s infinite',
    backgroundImage: `linear-gradient(
      90deg,
      ${fade(t.palette.common.white, 0)},
      ${fade(t.palette.common.white, 0.7)},
      ${fade(t.palette.common.white, 0)}
    )`,
    backgroundRepeat: 'no-repeat',
    backgroundSize: `${shimmerSize} 100%`,
    // This is the shared skeleton every loading state renders, so fixing it
    // here covers every page rather than each call site separately. A
    // shimmer that loops for as long as data is in flight is exactly the
    // kind of motion prefers-reduced-motion exists to stop; freeze it to one
    // static frame rather than speeding through repeats, since the content
    // it stands in for isn't changing either.
    '@media (prefers-reduced-motion: reduce)': {
      animationDuration: '0.01ms',
      animationIterationCount: 1,
    },
  },
}))

export interface SkeletonProps extends M.BoxProps {
  animate?: boolean
}

export default React.forwardRef(function Skeleton(
  { className, animate = true, ...props }: SkeletonProps,
  ref,
) {
  const classes = useStyles()
  return (
    <M.Box
      className={cx(className, classes.root, animate && classes.animate)}
      {...props}
      ref={ref}
    />
  )
})
