import * as React from 'react'
import cx from 'classnames'

import * as M from '@material-ui/core'

const useStyles = M.makeStyles((t) => ({
  root: {
    cursor: 'pointer',
    margin: `0 ${t.spacing(1)}px 0 0`,
  },
}))

export default function ButtonExpand({ className, onClick }) {
  const classes = useStyles()

  return (
    <M.InputAdornment className={cx(classes.root, className)} onClick={onClick}>
      <M.Icon fontSize="small">arrow_right</M.Icon>
    </M.InputAdornment>
  )
}
