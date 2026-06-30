import * as React from 'react'
import { Link } from 'react-router-dom'
import * as M from '@material-ui/core'

import Logo from 'components/Logo'
import cfg from 'constants/config'
import * as URLS from 'constants/urls'
import * as Bookmarks from 'containers/Bookmarks'
import * as NavMenu from 'containers/NavBar/NavMenu'
import useRoleSwitcher from 'containers/NavBar/RoleSwitcher'
import * as Subscription from 'containers/NavBar/Subscription'
import * as CatalogSettings from 'utils/CatalogSettings'
import * as NamedRoutes from 'utils/NamedRoutes'

import { Rail } from './Rail'

const useStyles = M.makeStyles((t) => ({
  root: {
    width: t.spacing(32),
  },
  // Match the 64px pseudo-header height so the logo and search bar align.
  logo: {
    alignItems: 'center',
    display: 'flex',
    height: 64,
    padding: t.spacing(0, 2),
  },
  workspaces: {
    paddingTop: t.spacing(1),
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
  nav: {
    paddingTop: t.spacing(1),
  },
  spacer: {
    flexGrow: 1,
  },
  links: {
    padding: t.spacing(1, 0),
  },
  account: {
    padding: t.spacing(1, 0, 2),
  },
}))

export function Sidebar() {
  const classes = useStyles()
  const { urls } = NamedRoutes.use()
  const settings = CatalogSettings.use()
  const subscription = Subscription.useState()
  const bookmarks = Bookmarks.use()
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
    <>
      <Rail className={classes.root}>
        <Link to={urls.home()} className={classes.logo}>
          <Logo height="36px" width="100%" src={settings?.logo?.url} />
        </Link>
        <M.Divider />

        {user && (
          <>
            <M.List disablePadding className={classes.workspaces}>
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
            <M.Divider />
          </>
        )}

        <M.List disablePadding className={classes.nav}>
          <M.ListItem button component={Link} to={urls.home()}>
            <M.ListItemIcon className={classes.icon}>
              <M.Icon>storage</M.Icon>
            </M.ListItemIcon>
            <M.ListItemText primary="Buckets" />
          </M.ListItem>
          <M.ListItem button onClick={bookmarks?.show} disabled={!bookmarks}>
            <M.ListItemIcon className={classes.icon}>
              <M.Badge color="primary" variant="dot" invisible={!bookmarks?.hasUpdates}>
                <M.Icon>bookmarks</M.Icon>
              </M.Badge>
            </M.ListItemIcon>
            <M.ListItemText primary="Bookmarks" />
          </M.ListItem>
        </M.List>

        <div className={classes.spacer} />

        <M.List disablePadding className={classes.links}>
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
        </M.List>
        <M.Divider />

        <M.List disablePadding className={classes.account}>
          {subscription.invalid && (
            <M.ListItem>
              <M.ListItemIcon className={classes.icon}>
                <M.Icon color="error">warning</M.Icon>
              </M.ListItemIcon>
              <M.ListItemText primary="Unlicensed" />
            </M.ListItem>
          )}
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
      <Bookmarks.Drawer />
    </>
  )
}
