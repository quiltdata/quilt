import * as React from 'react'
import { Link } from 'react-router-dom'
import * as M from '@material-ui/core'

import Logo from 'components/Logo'
import * as CatalogSettings from 'utils/CatalogSettings'
import * as NamedRoutes from 'utils/NamedRoutes'

const useStyles = M.makeStyles((t) => ({
  appBar: {
    background: t.palette.primary.main,
  },
  toolbar: {
    height: 64,
    minHeight: 64,
    paddingLeft: t.spacing(3),
  },
  link: {
    alignItems: 'center',
    display: 'flex',
    height: 64,

    '&:focus-visible': {
      outline: `2px solid ${t.palette.navigation.indicator}`,
      outlineOffset: 2,
    },
  },
}))

export default function BareHeader() {
  const classes = useStyles()
  const { urls } = NamedRoutes.use()
  const settings = CatalogSettings.use()
  return (
    <M.AppBar position="static" elevation={0} square className={classes.appBar}>
      <M.Toolbar disableGutters className={classes.toolbar}>
        <Link to={urls.home()} className={classes.link}>
          <Logo height="29px" width="100%" src={settings?.logo?.url} />
        </Link>
      </M.Toolbar>
    </M.AppBar>
  )
}
