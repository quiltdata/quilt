import * as React from 'react'

import * as M from '@material-ui/core'

const useStyles = M.makeStyles((t) => ({
  root: {
    color: t.palette.divider,
    cursor: 'pointer',
  },
}))

export default function MenuButton({ onClick }) {
  const classes = useStyles()
  return (
    <M.InputAdornment className={classes.root} onClick={onClick}>
      <M.Icon fontSize="small">arrow_drop_down</M.Icon>
    </M.InputAdornment>
  )
}
