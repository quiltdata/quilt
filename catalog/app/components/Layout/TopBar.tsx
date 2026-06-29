import * as React from 'react'
import * as RRDom from 'react-router-dom'
import * as M from '@material-ui/core'

import * as style from 'constants/style'
import { LogoLink } from 'containers/NavBar'
import * as NamedRoutes from 'utils/NamedRoutes'

import * as Assistant from 'components/Assistant'

export function TopBar() {
  const { urls } = NamedRoutes.use()
  return (
    <M.MuiThemeProvider theme={style.navTheme}>
      <M.AppBar position="static">
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
