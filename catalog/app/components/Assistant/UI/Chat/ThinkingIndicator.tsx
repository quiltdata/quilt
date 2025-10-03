/**
 * Thinking Indicator Component
 *
 * Animated 3-dot indicator shown while Qurator is processing,
 * matching Cursor's style.
 */

import * as React from 'react'
import * as M from '@material-ui/core'

const useStyles = M.makeStyles((t) => ({
  container: {
    display: 'flex',
    alignItems: 'center',
    gap: t.spacing(1),
    padding: t.spacing(2),
    color: t.palette.text.secondary,
  },
  dots: {
    display: 'flex',
    gap: '4px',
  },
  dot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: t.palette.text.secondary,
    animation: '$pulse 1.4s ease-in-out infinite',
  },
  dot1: {
    animationDelay: '0s',
  },
  dot2: {
    animationDelay: '0.2s',
  },
  dot3: {
    animationDelay: '0.4s',
  },
  '@keyframes pulse': {
    '0%, 60%, 100%': {
      opacity: 0.3,
      transform: 'scale(0.8)',
    },
    '30%': {
      opacity: 1,
      transform: 'scale(1)',
    },
  },
}))

export default function ThinkingIndicator() {
  const classes = useStyles()

  return (
    <div className={classes.container}>
      <div className={classes.dots}>
        <div className={`${classes.dot} ${classes.dot1}`} />
        <div className={`${classes.dot} ${classes.dot2}`} />
        <div className={`${classes.dot} ${classes.dot3}`} />
      </div>
    </div>
  )
}
