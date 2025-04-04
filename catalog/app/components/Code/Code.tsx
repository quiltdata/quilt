import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

const useStyles = M.makeStyles((t) => ({
  root: {
    background: t.palette.grey[300],
    borderRadius: '2px',
    color: t.palette.text.primary,
    fontFamily: t.typography.monospace.fontFamily,
    padding: '0 3px',
    whiteSpace: 'pre-wrap',
  },
}))

interface CodeProps {
  children: React.ReactNode
  className?: string
}

export default function Code({ className, children }: CodeProps) {
  const classes = useStyles()
  return <code className={cx(classes.root, className)}>{children}</code>
}
