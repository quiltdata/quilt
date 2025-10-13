import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import * as Hash from 'components/Hash'

const useStyles = M.makeStyles((t) => ({
  root: {
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
      <Hash.Trimmed className={classes.hash}>{hash}</Hash.Trimmed>
      {children}
    </div>
  )
}
