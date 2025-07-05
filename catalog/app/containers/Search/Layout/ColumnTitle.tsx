import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

type ColumnTitleProps = React.PropsWithChildren<{ className?: string }>

const useColumnTitleStyles = M.makeStyles((t) => ({
  root: {
    ...t.typography.h6,
    lineHeight: `${t.spacing(4.5)}px`,
  },
}))

export default function ColumnTitle({ className, children }: ColumnTitleProps) {
  const classes = useColumnTitleStyles()
  return <div className={cx(classes.root, className)}>{children}</div>
}
