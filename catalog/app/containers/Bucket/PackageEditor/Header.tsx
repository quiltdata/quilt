import * as React from 'react'
import * as M from '@material-ui/core'

const useStyles = M.makeStyles((t) => ({
  root: {
    padding: t.spacing(0, 2),
  },
  title: {
    marginRight: 'auto',
  },
}))

export default function Header() {
  const classes = useStyles()
  return (
    <M.AppBar position="sticky" color="inherit">
      <M.Toolbar disableGutters className={classes.root}>
        <M.Typography variant="h4" className={classes.title}>
          Curate package
        </M.Typography>
        <M.Button color="primary" variant="contained">
          <M.Icon>publish</M.Icon>Create
        </M.Button>
      </M.Toolbar>
    </M.AppBar>
  )
}
