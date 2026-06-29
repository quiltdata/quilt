import * as React from 'react'
import * as RRDom from 'react-router-dom'
import * as M from '@material-ui/core'

import * as Assistant from 'components/Assistant'
import * as style from 'constants/style'
import { LogoLink } from 'containers/NavBar'
import bg from 'containers/NavBar/bg.png'
import * as CatalogSettings from 'utils/CatalogSettings'
import * as NamedRoutes from 'utils/NamedRoutes'

const useStyles = M.makeStyles({
  appBar: {
    // Match the original NavBar header: brand navy + tiled texture, or the
    // stack's custom brand colour when configured.
    background: ({ customBg }: { customBg?: string }) =>
      customBg || `${style.navTheme.palette.secondary.dark} left / 64px url(${bg})`,
  },
})

export function TopBar() {
  const { urls } = NamedRoutes.use()
  const settings = CatalogSettings.use()
  const classes = useStyles({ customBg: settings?.theme?.palette?.primary?.main })
  return (
    <M.MuiThemeProvider theme={style.navTheme}>
      <M.AppBar position="static" className={classes.appBar}>
        <M.Toolbar>
          <LogoLink />
          <M.Box flexGrow={1} />
          <M.Button
            color="inherit"
            startIcon={<M.Icon>search</M.Icon>}
            component={RRDom.Link}
            to={urls.search({})}
          >
            Search
          </M.Button>
          <Assistant.UI.Trigger />
        </M.Toolbar>
      </M.AppBar>
    </M.MuiThemeProvider>
  )
}
