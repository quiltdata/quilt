import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import * as Hash from 'components/Hash'

const useStyles = M.makeStyles((t) => ({
  root: {
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
      <Hash.Trimmed className={classes.hash}>{hash}</Hash.Trimmed>
      {children}
    </div>
  )
}
