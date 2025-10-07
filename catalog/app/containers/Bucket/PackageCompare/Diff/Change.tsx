import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import { trimCenter } from 'utils/string'

import useColors from './useColors'

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
  const colors = useColors()
  const colorTag = React.useMemo(() => {
    switch (order._tag) {
      case 'latter':
        return 'added'
      case 'former':
        return 'removed'
      default:
        return ''
    }
  }, [order._tag])
  return (
    <div className={cx(classes.root, colors[colorTag], className)}>
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
