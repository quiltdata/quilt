import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

export type Order = 'former' | 'latter' | 'limbo'

export type Dir = 'backward' | 'forward'

const useStyles = M.makeStyles((t) => ({
  root: {
    borderRadius: '2px',
    padding: '0 2px',
  },
  latter: {
    backgroundColor: M.fade(t.palette.success.light, 0.3),
  },
  former: {
    backgroundColor: M.fade(t.palette.error.light, 0.3),
  },
  limbo: {},
}))

interface ChangeProps {
  children: React.ReactNode
  className?: string
  order: Order
}

export default function Change({ className, children, order }: ChangeProps) {
  const classes = useStyles()
  return <div className={cx(classes.root, classes[order], className)}>{children}</div>
}
