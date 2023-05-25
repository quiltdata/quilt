import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

const useStyles = M.makeStyles((t) => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    ...t.typography.subtitle1,
    marginBottom: t.spacing(2),
  },
  content: {
    border: `1px solid ${t.palette.action.disabled}`,
    borderRadius: t.shape.borderRadius,
    flexGrow: 1,
  },
}))

interface RemoteFilesProps {
  className: string
}

export default function RemoteFiles({ className }: RemoteFilesProps) {
  const classes = useStyles()
  return (
    <div className={cx(classes.root, className)}>
      <div className={classes.header}>S3 sources</div>
      <div className={classes.content}>List</div>
    </div>
  )
}
