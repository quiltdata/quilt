import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import { trimCenter } from 'utils/string'

const useStyles = M.makeStyles((t) => ({
  root: {
    borderRadius: '2px',
    paddingRight: t.spacing(11),
    position: 'relative',
  },
  hash: {
    ...t.typography.caption,
    color: t.palette.text.hint,
    position: 'absolute',
    right: t.spacing(0.5),
    top: 0,
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
