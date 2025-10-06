import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import { trimCenter } from 'utils/string'

export type Order =
  | { _tag: 'former'; hash: string }
  | { _tag: 'latter'; hash: string }
  | { _tag: 'limbo' }

export type Dir =
  | { _tag: 'backward'; from: string; to: string }
  | { _tag: 'forward'; from: string; to: string }

const useStyles = M.makeStyles((t) => ({
  root: {
    borderRadius: '2px',
    padding: t.spacing(0, 11, 0, 0.25),
    position: 'relative',
  },
  latter: {
    backgroundColor: M.fade(t.palette.success.light, 0.3),
  },
  former: {
    backgroundColor: M.fade(t.palette.error.light, 0.3),
  },
  limbo: {},
  legend: {
    position: 'absolute',
    ...t.typography.caption,
    color: t.palette.text.hint,
    top: 0,
    right: t.spacing(0.5),
  },
}))

interface ChangeProps {
  children: React.ReactNode
  className?: string
  order: Order
}

export default function Change({ className, children, order }: ChangeProps) {
  const classes = useStyles()
  return (
    <div className={cx(classes.root, classes[order._tag], className)}>
      {order._tag === 'latter' && (
        <span className={classes.legend}>{trimCenter(order.hash, 12)}</span>
      )}
      {order._tag === 'former' && (
        <span className={classes.legend}>{trimCenter(order.hash, 12)}</span>
      )}
      {children}
    </div>
  )
}
