import * as React from 'react'
import * as M from '@material-ui/core'

const useColumnTitleStyles = M.makeStyles((t) => ({
  root: {
    ...t.typography.h6,
    lineHeight: `${t.spacing(4.5)}px`,
  },
}))

export default function ColumnTitle({ children }: React.PropsWithChildren<{}>) {
  const classes = useColumnTitleStyles()
  return <div className={classes.root}>{children}</div>
}
