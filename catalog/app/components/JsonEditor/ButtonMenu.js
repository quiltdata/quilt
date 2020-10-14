import * as React from 'react'
import cx from 'classnames'

import * as M from '@material-ui/core'

const useStyles = M.makeStyles((t) => ({
  root: {
    color: t.palette.divider,
    cursor: 'pointer',
  },

  note: {
    fontFamily: t.typography.monospace.fontFamily,
    fontSize: t.typography.caption.fontSize,
    marginRight: t.spacing(0.5),
  },
}))

export default function ButtonMenu({ className, note, onClick }) {
  const classes = useStyles()

  return (
    <M.InputAdornment className={cx(classes.root, className)} onClick={onClick}>
      <code className={classes.note}>{note}</code>
      <M.Icon fontSize="small">arrow_drop_down</M.Icon>
    </M.InputAdornment>
  )
}
