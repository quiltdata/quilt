import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

const useColumnTitleStyles = M.makeStyles((t) => ({
  root: {
    ...t.typography.h6,
    lineHeight: `${t.spacing(4.5)}px`,
  },
}))

export default function ColumnTitle({
  className,
  children,
}: React.PropsWithChildren<{ className?: string }>) {
  const classes = useColumnTitleStyles()
  return <div className={cx(classes.root, className)}>{children}</div>
}
