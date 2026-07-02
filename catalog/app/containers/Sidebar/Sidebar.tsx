import * as React from 'react'
import { Link } from 'react-router-dom'
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
  workspaceButton: {
    background: fade('#fff', 0.05),
    borderRadius: t.shape.borderRadius * 2,
    margin: t.spacing(0, 1.5, 1),
    padding: t.spacing(1, 1.5),
    textAlign: 'left',
    width: `calc(100% - ${t.spacing(3)}px)`,
    '&:hover': {
      background: fade('#fff', 0.1),
    },
  },
  workspaceAvatar: {
    alignItems: 'center',
    background: t.palette.primary.main,
    borderRadius: '50%',
    color: t.palette.common.white,
    display: 'flex',
    flexShrink: 0,
    fontSize: 13,
    fontWeight: 500,
    height: 30,
    justifyContent: 'center',
    marginRight: t.spacing(1.5),
    textTransform: 'lowercase',
    width: 30,
  },
  workspaceText: {
    flexGrow: 1,
    lineHeight: 1.25,
    minWidth: 0,
  },
  workspaceName: {
    fontSize: 13.5,
    fontWeight: 500,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  workspaceRole: {
    color: fade('#fff', 0.55),
    fontSize: 11,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  workspaceCaret: {
    color: fade('#fff', 0.5),
    flexShrink: 0,
    fontSize: 16,
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
  const { urls } = NamedRoutes.use()
  const settings = CatalogSettings.use()
  const subscription = Subscription.useState()
  const bookmarks = Bookmarks.use()
  const assistant = Assistant.Model.useAssistantAPI()
  const auth = NavMenu.useAuthState()
  const switchRole = useRoleSwitcher()

  const user = NavMenu.AuthState.match(
    { Ready: ({ user: u }) => u, Loading: () => null, Error: () => null },
    auth,
  )

  // The workspace is the active role's reachable-volume scope (per the access
  // spec: switching workspace IS switch-role, persistent and global). The rail
  // presents the primary role as the workspace identity; clicking it opens the
  // role switcher when the user holds more than one role.
  const canSwitch = !!user && user.roles.length > 1
  const workspace = user && (
    <M.ButtonBase
      className={classes.workspaceButton}
      onClick={canSwitch ? () => switchRole(user) : undefined}
      disabled={!canSwitch}
      title={canSwitch ? 'Switch workspace (role)' : undefined}
    >
      <span className={classes.workspaceAvatar}>{user.name.slice(0, 2)}</span>
      <span className={classes.workspaceText}>
        <M.Typography className={classes.workspaceName} component="span" display="block">
          {user.name}
        </M.Typography>
        <M.Typography className={classes.workspaceRole} component="span" display="block">
          {user.role.name}
        </M.Typography>
      </span>
      {canSwitch && <M.Icon className={classes.workspaceCaret}>expand_more</M.Icon>}
    </M.ButtonBase>
  )

  return (
    <>
      <Rail className={classes.root}>
        <Link to={urls.home()} className={classes.logo}>
          <Logo height="32px" width="100%" src={settings?.logo?.url} />
        </Link>
        <M.Divider className={classes.logoDivider} />

        {user && (
          <>
            <div className={classes.workspaces}>
              <M.ListSubheader disableSticky className={classes.title} component="div">
                Workspace
              </M.ListSubheader>
              {workspace}
            </div>
            <M.Divider />
          </>
        )}

        <M.List disablePadding className={classes.nav}>
          <M.ListItem button component={Link} to={urls.home()}>
            <M.ListItemIcon className={classes.icon}>
              <M.Icon>home</M.Icon>
            </M.ListItemIcon>
            <M.ListItemText primary="Home" />
          </M.ListItem>
          <M.ListItem
            button
            component={Link}
            to={cfg.frontDoorV2 ? urls.buckets() : urls.home()}
          >
            <M.ListItemIcon className={classes.icon}>
              <M.Icon>storage</M.Icon>
            </M.ListItemIcon>
            <M.ListItemText primary="Volumes" />
          </M.ListItem>
          <VolumeSelect />
          <M.ListItem button component={Link} to={urls.tables()}>
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
