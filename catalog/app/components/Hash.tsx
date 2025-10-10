import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

const useStyles = M.makeStyles((t) => ({
  root: {
    ...t.typography.monospace,
  },
}))

interface Props {
  className?: string
  children: string
}

export function Full({ className, children }: Props) {
  const classes = useStyles()
  return <span className={cx(classes.root, className)}>{children}</span>
}

export function Trimmed({ className, children }: Props) {
  const classes = useStyles()
  return <span className={cx(classes.root, className)}>{children.substring(0, 12)}</span>
}
