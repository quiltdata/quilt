import * as React from 'react'
import { Link } from 'react-router-dom'
import * as M from '@material-ui/core'

import cfg from 'constants/config'
import * as NavMenu from 'containers/NavBar/NavMenu'
import * as Subscription from 'containers/NavBar/Subscription'
import * as NamedRoutes from 'utils/NamedRoutes'

function SignIn() {
  const { urls } = NamedRoutes.use()
  return (
    <M.ListItem button component={Link} to={urls.signIn()}>
      <M.ListItemIcon>
        <M.Icon>exit_to_app</M.Icon>
      </M.ListItemIcon>
      <M.ListItemText primary="Sign In" />
    </M.ListItem>
  )
}

export function AccountZone() {
  const subscription = Subscription.useState()
  const auth = NavMenu.useAuthState()
  const getAuthItems = NavMenu.useGetAuthItems()

  return (
    <M.List disablePadding dense>
      {subscription.invalid && (
        <M.ListItem>
          <M.ListItemIcon>
            <M.Icon color="error">warning</M.Icon>
          </M.ListItemIcon>
          <M.ListItemText primary="Unlicensed" />
        </M.ListItem>
      )}
      {cfg.mode !== 'LOCAL' &&
        NavMenu.AuthState.match({
          Ready: ({ user }) =>
            user ? <NavMenu.AuthItemsList items={getAuthItems(user)} /> : <SignIn />,
          Loading: () => (
            <M.ListItem>
              <M.ListItemIcon>
                <M.CircularProgress size={20} />
              </M.ListItemIcon>
              <M.ListItemText primary="Loading…" />
            </M.ListItem>
          ),
          Error: () => <SignIn />,
        })(auth)}
    </M.List>
  )
}
