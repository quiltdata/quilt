import * as React from 'react'
import * as M from '@material-ui/core'

import * as State from './State'

const useStyles = M.makeStyles((t) => ({
  root: {
    padding: t.spacing(0, 2),
  },
  title: {
    ...t.typography.h4,
    marginRight: 'auto',
  },
}))

export default function Header() {
  const classes = useStyles()
  const { main } = State.use()
  return (
    <M.AppBar position="sticky" color="inherit">
      <M.Toolbar disableGutters className={classes.root}>
        <M.Typography className={classes.title}>Curate package</M.Typography>
        <M.Button color="primary" variant="contained" onClick={main.actions.onSubmit}>
          <M.Icon>publish</M.Icon>Create
        </M.Button>
      </M.Toolbar>
    </M.AppBar>
  )
}
