import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'
import { fade } from '@material-ui/core/styles'

const useStyles = M.makeStyles((t) => ({
  root: {
    alignItems: 'center',
    background: fade(t.palette.background.paper, 0.5),
    bottom: 0,
    cursor: 'not-allowed',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 3, // above Select, Checkbox and sticky table header
  },
}))

interface LockProps {
  className?: string
  children?: React.ReactNode
}

export default function Lock({ children, className }: LockProps) {
  const classes = useStyles()
  return <div className={cx(classes.root, className)}>{children}</div>
}
