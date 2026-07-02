import * as React from 'react'
import { Link, useRouteMatch } from 'react-router-dom'
import * as M from '@material-ui/core'
import { fade } from '@material-ui/core/styles'

import * as Assistant from 'components/Assistant'
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
import VolumeSelect from './VolumeSelect'

const useStyles = M.makeStyles((t) => ({
  root: {
    width: t.spacing(32),
    // Collapse to an icon-only rail on small screens so the content column
    // keeps a usable width; labels and the volume picker hide below.
    [t.breakpoints.down('sm')]: {
      width: t.spacing(9),
      '& .MuiListItemText-root, & .MuiListSubheader-root': {
        display: 'none',
      },
    },
  },
  // Match the 64px pseudo-header height so the logo and search bar align.
  logo: {
    alignItems: 'center',
    display: 'flex',
    height: 64,
    padding: t.spacing(0, 2),
  },
  logoDivider: {
    marginTop: -1,
  },
  workspaces: {
    paddingTop: t.spacing(1),
  },
  title: {
    ...t.typography.overline,
    color: fade('#fff', 0.4),
    fontWeight: 500,
    letterSpacing: '0.12em',
    lineHeight: '32px',
  },
  icon: {
    color: 'inherit',
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
  const t = M.useTheme()
  // Icon-only rail on small screens; the text labels are hidden via CSS and
  // the logo/volume picker swap to compact affordances here.
  const compact = M.useMediaQuery(t.breakpoints.down('sm'))
  const { paths, urls } = NamedRoutes.use()
  const settings = CatalogSettings.use()
  const subscription = Subscription.useState()
  const bookmarks = Bookmarks.use()
  const assistant = Assistant.Model.useAssistantAPI()
  const auth = NavMenu.useAuthState()
  const switchRole = useRoleSwitcher()
  // The Volumes entry points at /buckets when the FrontDoor owns "/", or at
  // "/" itself otherwise; highlight it wherever it actually leads.
  const onBucketsRoute = !!useRouteMatch({ path: paths.buckets, exact: true })
  const onHomeRoute = !!useRouteMatch({ path: paths.home, exact: true })
  const onVolumes = cfg.frontDoorV2 ? onBucketsRoute : onHomeRoute || onBucketsRoute
  const onTables = !!useRouteMatch({ path: paths.tables, exact: true })

  const user = NavMenu.AuthState.match(
    { Ready: ({ user: u }) => u, Loading: () => null, Error: () => null },
    auth,
  )

  const workspace = user && (
    <>
      <M.ListItemIcon className={classes.icon}>
        <M.Icon>work_outline</M.Icon>
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
          {compact ? (
            <Logo height="27px" width="27px" src={settings?.logo?.url} />
          ) : (
            <Logo height="32px" width="100%" src={settings?.logo?.url} />
          )}
        </Link>
        <M.Divider className={classes.logoDivider} />

        {user && (
          <>
            <M.List disablePadding className={classes.workspaces}>
              <M.ListSubheader disableSticky className={classes.title}>
                Workspace
              </M.ListSubheader>
              {user.roles.length > 1 ? (
                <M.ListItem button onClick={() => switchRole(user)}>
                  {workspace}
                </M.ListItem>
              ) : (
                <M.ListItem>{workspace}</M.ListItem>
              )}
            </M.List>
            <M.Divider />
          </>
        )}

        {/* The logo is the "Home" affordance per the markup; the nav leads with
            Volumes and highlights it while the volume listing is open. */}
        <M.List disablePadding className={classes.nav}>
          <M.ListItem
            button
            component={Link}
            selected={onVolumes}
            to={cfg.frontDoorV2 ? urls.buckets() : urls.home()}
          >
            <M.ListItemIcon className={classes.icon}>
              <M.Icon>storage</M.Icon>
            </M.ListItemIcon>
            <M.ListItemText primary="Volumes" />
          </M.ListItem>
          {!compact && <VolumeSelect />}
          <M.ListItem button component={Link} selected={onTables} to={urls.tables()}>
            <M.ListItemIcon className={classes.icon}>
              <M.Icon>table_chart</M.Icon>
            </M.ListItemIcon>
            <M.ListItemText primary="Tables" />
          </M.ListItem>
          <M.ListItem button onClick={bookmarks?.show} disabled={!bookmarks}>
            <M.ListItemIcon className={classes.icon}>
              <M.Badge color="primary" variant="dot" invisible={!bookmarks?.hasUpdates}>
                <M.Icon>bookmarks</M.Icon>
              </M.Badge>
            </M.ListItemIcon>
            <M.ListItemText primary="Bookmarks" />
          </M.ListItem>
          {assistant && (
            <M.ListItem button onClick={assistant.show}>
              <M.ListItemIcon className={classes.icon}>
                <M.Icon>assistant</M.Icon>
              </M.ListItemIcon>
              <M.ListItemText primary="Qurator" />
            </M.ListItem>
          )}
          {user?.isAdmin && (
            <>
              <M.Divider />
              <M.ListItem button component={Link} to={urls.admin()}>
                <M.ListItemIcon className={classes.icon}>
                  <M.Icon>security</M.Icon>
                </M.ListItemIcon>
                <M.ListItemText primary="Admin" />
              </M.ListItem>
            </>
          )}
        </M.List>

        <div className={classes.spacer} />

        <M.List disablePadding className={classes.links} dense>
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

        <M.List disablePadding className={classes.account} dense>
          {user && (
            <M.ListItem>
              <M.ListItemIcon className={classes.icon}>
                <M.Icon>account_circle</M.Icon>
              </M.ListItemIcon>
              <M.ListItemText primary={user.name} />
            </M.ListItem>
          )}
          {subscription.invalid && (
            <M.ListItem>
              <M.ListItemIcon className={classes.icon}>
                <M.Icon color="error">warning</M.Icon>
              </M.ListItemIcon>
              <M.ListItemText primary="Unlicensed" />
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
