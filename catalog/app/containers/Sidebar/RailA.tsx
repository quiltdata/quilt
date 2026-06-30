import * as React from 'react'
import { Link } from 'react-router-dom'
import * as M from '@material-ui/core'

import Logo from 'components/Logo'
import cfg from 'constants/config'
import * as URLS from 'constants/urls'
import * as NavMenu from 'containers/NavBar/NavMenu'
import useRoleSwitcher from 'containers/NavBar/RoleSwitcher'
import * as Subscription from 'containers/NavBar/Subscription'
import * as CatalogSettings from 'utils/CatalogSettings'
import * as NamedRoutes from 'utils/NamedRoutes'

import { Rail } from './Rail'

const useStyles = M.makeStyles((t) => ({
  root: {
    paddingTop: t.spacing(1),
    width: t.spacing(30),
  },
  logo: {
    display: 'flex',
    padding: t.spacing(1, 2, 2),
  },
  title: {
    ...t.typography.subtitle1,
    color: 'inherit',
    fontWeight: 500,
  },
  icon: {
    color: 'inherit',
    minWidth: 36,
  },
  spacer: {
    flexGrow: 1,
  },
}))

export function RailA() {
  const classes = useStyles()
  const { urls } = NamedRoutes.use()
  const settings = CatalogSettings.use()
  const subscription = Subscription.useState()
  const auth = NavMenu.useAuthState()
  const switchRole = useRoleSwitcher()

  const user = NavMenu.AuthState.match(
    { Ready: ({ user: u }) => u, Loading: () => null, Error: () => null },
    auth,
  )

  const identity = user && (
    <>
      <M.ListItemIcon className={classes.icon}>
        <M.Icon>account_circle</M.Icon>
      </M.ListItemIcon>
      <M.ListItemText primary={user.name} secondary={user.role.name} />
    </>
  )

  return (
    <Rail className={classes.root}>
      <Link to={urls.home()} className={classes.logo}>
        <Logo height="36px" width="36px" src={settings?.logo?.url} />
      </Link>

      {user && (
        <M.List dense disablePadding>
          <M.ListSubheader disableSticky className={classes.title}>
            Workspaces
          </M.ListSubheader>
          {cfg.mode === 'OPEN' ? (
            <M.ListItem button component={Link} to={urls.profile()}>
              {identity}
            </M.ListItem>
          ) : (
            <M.ListItem>{identity}</M.ListItem>
          )}
          {user.roles.length > 1 && (
            <M.ListItem button onClick={() => switchRole(user)}>
              <M.ListItemIcon className={classes.icon}>
                <M.Icon>people_outline</M.Icon>
              </M.ListItemIcon>
              <M.ListItemText
                primary="Switch role"
                secondary={`${user.roles.length} available`}
              />
            </M.ListItem>
          )}
        </M.List>
      )}

      <div className={classes.spacer} />

      <M.List dense disablePadding>
        {subscription.invalid && (
          <M.ListItem>
            <M.ListItemIcon className={classes.icon}>
              <M.Icon color="error">warning</M.Icon>
            </M.ListItemIcon>
            <M.ListItemText primary="Unlicensed" />
          </M.ListItem>
        )}
        <M.ListItem button component={Link} to={urls.uriResolver('')}>
          <M.ListItemIcon className={classes.icon}>
            <M.Icon>link</M.Icon>
          </M.ListItemIcon>
          <M.ListItemText primary="URI" />
        </M.ListItem>
        <M.ListItem button component="a" href={URLS.docs} target="_blank">
          <M.ListItemIcon className={classes.icon}>
            <M.Icon>menu_book</M.Icon>
          </M.ListItemIcon>
          <M.ListItemText primary="Docs" />
        </M.ListItem>
        {user?.isAdmin && (
          <M.ListItem button component={Link} to={urls.admin()}>
            <M.ListItemIcon className={classes.icon}>
              <M.Icon>security</M.Icon>
            </M.ListItemIcon>
            <M.ListItemText primary="Admin" />
          </M.ListItem>
        )}
        {cfg.mode !== 'LOCAL' &&
          (user ? (
            <M.ListItem button component={Link} to={urls.signOut()}>
              <M.ListItemIcon className={classes.icon}>
                <M.Icon>meeting_room</M.Icon>
              </M.ListItemIcon>
              <M.ListItemText primary="Sign Out" />
            </M.ListItem>
          ) : (
            <M.ListItem button component={Link} to={urls.signIn()}>
              <M.ListItemIcon className={classes.icon}>
                <M.Icon>exit_to_app</M.Icon>
              </M.ListItemIcon>
              <M.ListItemText primary="Sign In" />
            </M.ListItem>
          ))}
      </M.List>
    </Rail>
  )
}
