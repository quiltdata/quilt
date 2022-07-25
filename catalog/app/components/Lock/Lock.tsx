import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

const useStyles = M.makeStyles({
  root: {
    background: 'rgba(255,255,255,0.5)',
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 1,
  },
})

interface LockProps extends M.BoxProps {
  className?: string
}

export default function Lock({ className }: LockProps) {
  const classes = useStyles()
  return <div className={cx(classes.root, className)} />
}
