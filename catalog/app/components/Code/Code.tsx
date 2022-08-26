import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

const useCodeStyles = M.makeStyles((t) => ({
  root: {
    background: t.palette.grey[300],
    borderRadius: '2px',
    color: t.palette.text.primary,
    fontFamily: (t.typography as $TSFixMe).monospace.fontFamily,
    padding: '0 3px',
    whiteSpace: 'pre-wrap',
  },
}))

interface CodeProps {
  children: React.ReactNode
  className?: string
}

export default function Code({ className, children }: CodeProps) {
  const classes = useCodeStyles()
  return <code className={cx(classes.root, className)}>{children}</code>
}
