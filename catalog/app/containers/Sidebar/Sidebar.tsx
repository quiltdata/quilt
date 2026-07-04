import * as React from 'react'
import { Link, useRouteMatch } from 'react-router-dom'
import * as M from '@material-ui/core'

import * as Assistant from 'components/Assistant'
import Logo from 'components/Logo'
import cfg from 'constants/config'
import * as URLS from 'constants/urls'
import * as Bookmarks from 'containers/Bookmarks'
import * as NavMenu from 'containers/NavBar/NavMenu'
import useRoleSwitcher from 'containers/NavBar/RoleSwitcher'
import * as Subscription from 'containers/NavBar/Subscription'
import * as Notifications from 'containers/Notifications'
import * as CatalogSettings from 'utils/CatalogSettings'
import * as NamedRoutes from 'utils/NamedRoutes'
import copyToClipboard from 'utils/clipboard'

import FollowMenu from './FollowMenu'
import OutlinedIcon from './OutlinedIcon'
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
    fontWeight: 500,
  },
  icon: {
    color: 'inherit',
  },
  nav: {
    paddingTop: t.spacing(2),
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
  version: {
    ...t.typography.caption,
    alignItems: 'center',
    color: 'inherit',
    cursor: 'pointer',
    display: 'flex',
    gap: t.spacing(0.5),
    padding: t.spacing(1, 2),
    '&:hover $copyIcon': {
      visibility: 'visible',
    },
  },
  versionText: {
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  copyIcon: {
    fontSize: '1rem',
    marginLeft: t.spacing(0.5),
    visibility: 'hidden',
  },
}))

function Version() {
  const classes = useStyles()
  const { push } = Notifications.use()
  const handleCopy = React.useCallback(() => {
    copyToClipboard(cfg.stackVersion)
    push('Web catalog container hash has been copied to clipboard')
  }, [push])
  if (!cfg.stackVersion) return null
  return (
    <div
      className={classes.version}
      onClick={handleCopy}
      title="Copy Platform release version to clipboard"
    >
      <span className={classes.versionText}>Version: {cfg.stackVersion}</span>
      <OutlinedIcon className={classes.copyIcon}>content_copy</OutlinedIcon>
    </div>
  )
}

export function Sidebar() {
  const classes = useStyles()
  const { urls, paths } = NamedRoutes.use()
  const settings = CatalogSettings.use()
  const subscription = Subscription.useState()
  const bookmarks = Bookmarks.use()
  const assistant = Assistant.Model.useAssistantAPI()
  const auth = NavMenu.useAuthState()
  const switchRole = useRoleSwitcher()

  // Volumes also owns bucket-browsing routes (`/b/*`), since that's where
  // clicking into a volume from the home list leads. Data products are volumes
  // too (an un-bucketed virtual volume), so `/data-products/*` highlights it as
  // well.
  const isHome = !!useRouteMatch({ path: paths.home, exact: true })
  const isBucket = !!useRouteMatch(paths.bucketRoot)
  const isDataProduct = !!useRouteMatch(paths.dataProduct)
  const volumesActive = isHome || isBucket || isDataProduct
  const searchActive = !!useRouteMatch(paths.search)
  const queriesActive = !!useRouteMatch(paths.queries)
  const adminActive = !!useRouteMatch(paths.admin)

  const user = NavMenu.AuthState.match(
    { Ready: ({ user: u }) => u, Loading: () => null, Error: () => null },
    auth,
  )

  const workspace = user && (
    <>
      <M.ListItemIcon className={classes.icon}>
        <OutlinedIcon>work_outline</OutlinedIcon>
      </M.ListItemIcon>
      <M.ListItemText
        primary={user.role.name}
        secondary={user.roles.length > 1 ? `${user.roles.length} available` : undefined}
      />
    </>
  )

  return (
    <>
      <Rail className={classes.root}>
        <Link to={urls.home()} className={classes.logo}>
          <Logo height="32px" width="100%" src={settings?.logo?.url} />
        </Link>

        {user && (
          <>
            <M.List disablePadding className={classes.workspaces}>
              <M.ListSubheader disableSticky className={classes.title}>
                Workspace
              </M.ListSubheader>
              {user.roles.length > 1 ? (
                <M.ListItem button onClick={() => switchRole(user)} selected>
                  {workspace}
                </M.ListItem>
              ) : (
                <M.ListItem selected>{workspace}</M.ListItem>
              )}
            </M.List>
          </>
        )}

        <M.List disablePadding className={classes.nav}>
          <M.ListItem button component={Link} to={urls.home()} selected={volumesActive}>
            <M.ListItemIcon className={classes.icon}>
              <OutlinedIcon>storage</OutlinedIcon>
            </M.ListItemIcon>
            <M.ListItemText primary="Volumes" />
          </M.ListItem>
          <M.ListItem
            button
            component={Link}
            to={urls.search({})}
            selected={searchActive}
          >
            <M.ListItemIcon className={classes.icon}>
              <OutlinedIcon>search</OutlinedIcon>
            </M.ListItemIcon>
            <M.ListItemText primary="Search" />
          </M.ListItem>
          <M.ListItem
            button
            component={Link}
            to={urls.queries()}
            selected={queriesActive}
          >
            <M.ListItemIcon className={classes.icon}>
              <OutlinedIcon>table_chart</OutlinedIcon>
            </M.ListItemIcon>
            <M.ListItemText primary="Queries" />
          </M.ListItem>
          <M.ListItem button onClick={bookmarks?.show} disabled={!bookmarks}>
            <M.ListItemIcon className={classes.icon}>
              <M.Badge color="primary" variant="dot" invisible={!bookmarks?.hasUpdates}>
                <OutlinedIcon>bookmarks</OutlinedIcon>
              </M.Badge>
            </M.ListItemIcon>
            <M.ListItemText primary="Bookmarks" />
          </M.ListItem>
          {assistant && (
            <M.ListItem button onClick={assistant.show}>
              <M.ListItemIcon className={classes.icon}>
                <OutlinedIcon>assistant</OutlinedIcon>
              </M.ListItemIcon>
              <M.ListItemText primary="Ask Qurator" />
            </M.ListItem>
          )}
          {user?.isAdmin && (
            <M.ListItem button component={Link} to={urls.admin()} selected={adminActive}>
              <M.ListItemIcon className={classes.icon}>
                <OutlinedIcon>security</OutlinedIcon>
              </M.ListItemIcon>
              <M.ListItemText primary="Admin" />
            </M.ListItem>
          )}
        </M.List>

        <div className={classes.spacer} />

        <M.List disablePadding className={classes.links} dense>
          <M.ListSubheader disableSticky className={classes.title}>
            Resources
          </M.ListSubheader>
          <M.ListItem button component={Link} to={urls.uriResolver('')}>
            <M.ListItemIcon className={classes.icon}>
              <OutlinedIcon>link</OutlinedIcon>
            </M.ListItemIcon>
            <M.ListItemText primary="URI" />
          </M.ListItem>
          <M.ListItem button component="a" href={URLS.docs} target="_blank">
            <M.ListItemIcon className={classes.icon}>
              <OutlinedIcon>menu_book</OutlinedIcon>
            </M.ListItemIcon>
            <M.ListItemText primary="Docs" />
          </M.ListItem>
          <FollowMenu iconClassName={classes.icon} />
        </M.List>

        <M.List disablePadding className={classes.account} dense>
          <M.ListSubheader disableSticky className={classes.title}>
            Account
          </M.ListSubheader>
          {user && (
            <M.ListItem>
              <M.ListItemIcon className={classes.icon}>
                <OutlinedIcon>account_circle</OutlinedIcon>
              </M.ListItemIcon>
              <M.ListItemText primary={user.name} />
            </M.ListItem>
          )}
          {subscription.invalid && (
            <M.ListItem>
              <M.ListItemIcon className={classes.icon}>
                <OutlinedIcon color="error">warning</OutlinedIcon>
              </M.ListItemIcon>
              <M.ListItemText primary="Unlicensed" />
            </M.ListItem>
          )}
          {cfg.mode !== 'LOCAL' &&
            (user ? (
              <M.ListItem button component={Link} to={urls.signOut()}>
                <M.ListItemIcon className={classes.icon}>
                  <OutlinedIcon>meeting_room</OutlinedIcon>
                </M.ListItemIcon>
                <M.ListItemText primary="Sign Out" />
              </M.ListItem>
            ) : (
              <M.ListItem button component={Link} to={urls.signIn()}>
                <M.ListItemIcon className={classes.icon}>
                  <OutlinedIcon>exit_to_app</OutlinedIcon>
                </M.ListItemIcon>
                <M.ListItemText primary="Sign In" />
              </M.ListItem>
            ))}
        </M.List>
        <Version />
      </Rail>
      <Bookmarks.Drawer />
    </>
  )
}
