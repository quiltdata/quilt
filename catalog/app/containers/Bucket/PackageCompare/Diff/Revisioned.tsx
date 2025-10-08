import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import { trimCenter } from 'utils/string'

const useStyles = M.makeStyles((t) => ({
  root: {
    borderRadius: '2px',
    padding: t.spacing(0, 11, 0, 0.25),
    position: 'relative',
  },
  hash: {
    position: 'absolute',
    ...t.typography.caption,
    color: t.palette.text.hint,
    top: 0,
    right: t.spacing(0.5),
  },
}))

interface RevisionedProps {
  children: React.ReactNode
  className?: string
  hash: string
}

export default function Revisioned({ className, children, hash }: RevisionedProps) {
  const classes = useStyles()
  return (
    <div className={cx(classes.root, className)}>
      <span className={classes.hash}>{trimCenter(hash, 12)}</span>
      {children}
    </div>
  )
}
