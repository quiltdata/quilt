import * as React from 'react'
import * as M from '@material-ui/core'

import { readableBytes } from 'utils/string'

const useStyles = M.makeStyles(() => ({
  icon: {
    marginLeft: 4,
  },
}))

export default function FilesStats({ files, warning }) {
  const classes = useStyles()

  const totalSize = React.useMemo(() => files.reduce((sum, f) => sum + f.size, 0), [
    files,
  ])

  if (!files.length) return null

  return (
    <span>
      : {files.length} ({readableBytes(totalSize)})
      {warning && <M.Icon className={classes.icon}>error_outline</M.Icon>}
    </span>
  )
}
