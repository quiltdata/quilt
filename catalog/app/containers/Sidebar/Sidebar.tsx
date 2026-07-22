import * as React from 'react'
import cx from 'classnames'
import { Link, useRouteMatch } from 'react-router-dom'
import * as M from '@material-ui/core'
import { fade } from '@material-ui/core/styles'

import * as Assistant from 'components/Assistant'
import Logo from 'components/Logo'
import cfg from 'constants/config'
import * as style from 'constants/style'
import * as Bookmarks from 'containers/Bookmarks'
import * as NavMenu from 'containers/NavBar/NavMenu'
import useRoleSwitcher from 'containers/NavBar/RoleSwitcher'
import * as Subscription from 'containers/NavBar/Subscription'
import * as Notifications from 'containers/Notifications'
import * as CatalogSettings from 'utils/CatalogSettings'
import * as NamedRoutes from 'utils/NamedRoutes'
import copyToClipboard from 'utils/clipboard'

import OutlinedIcon from './OutlinedIcon'
import { Rail } from './Rail'

const useStyles = M.makeStyles((t) => {
  const box = {
    backgroundColor: fade(t.palette.common.white, 0.08),
    borderRadius: 4,
    overflow: 'hidden',
  }
  const iconCol = {
    '& $icon': {
      minWidth: 34,
    },
  }
  const rowHover = {
    '&:hover': {
      backgroundColor: fade(t.palette.common.white, 0.06),
    },
  }
  return {
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
    workspaceBox: {
      ...box,
      margin: t.spacing(0, 1, 1),
    },
    icon: {
      color: 'inherit',
      '& .material-icons': {
        fontSize: 20,
      },
    },
    sectionLabel: {
      color: t.palette.navigation.textMuted,
      fontSize: 11,
      fontWeight: 500,
      letterSpacing: '0.06em',
      lineHeight: '16px',
      padding: t.spacing(1, 2.5, 0.5),
      textTransform: 'uppercase',
    },
    wsRow: {
      padding: t.spacing(1, 1.5, 1, 2),
      ...iconCol,
    },
    wsRowClickable: {
      ...rowHover,
    },
    wsText: {
      minWidth: 0,
    },
    trailing: {
      color: fade(t.palette.common.white, 0.55),
      fontSize: 20,
    },
    identityBox: {
      ...box,
      margin: t.spacing(0, 1, 1.5),
    },
    identityRow: {
      height: 44,
      padding: t.spacing(0, 1.5, 0, 2),
      ...iconCol,
      ...rowHover,
    },
    // Accepted via impeccable live (2026-07-21): inset rounded nav rows —
    // 8px side inset, 4px radius, 44px rows, 16px icon-label gap, flush items.
    nav: {
      padding: t.spacing(1.5, 1, 0),
    },
    // The active nav item is the single "you are here": stronger fill, heavier
    // label, and the amber indicator bracket.
    navItem: {
      borderRadius: 4,
      height: 44,
      padding: t.spacing(0, 1.5, 0, 2),
      ...iconCol,
      ...rowHover,
      '&.Mui-focusVisible': {
        outline: `2px solid ${fade(t.palette.common.white, 0.85)}`,
        outlineOffset: -2,
      },
      '&.Mui-selected': {
        backgroundColor: fade(t.palette.common.white, 0.18),
        color: t.palette.common.white,
        fontWeight: t.typography.fontWeightMedium,
        '&:hover': {
          backgroundColor: fade(t.palette.common.white, 0.24),
        },
        '&::before': {
          // amber indicator — accepted via impeccable live 2026-07-22: 3px
          // bracket, 8px vertical inset. Sourced from palette.navigation.indicator
          // (do not use t.palette.secondary — that's a different amber/cobalt
          // depending on which theme is ambient).
          background: t.palette.navigation.indicator,
          borderRadius: '0 2px 2px 0',
          bottom: 8,
          content: '""',
          left: 0,
          position: 'absolute',
          top: 8,
          width: 3,
        },
      },
    },
    navLabel: {
      color: 'inherit',
      fontWeight: 'inherit',
    },
    spacer: {
      flexGrow: 1,
    },
    account: {
      padding: t.spacing(0.5, 0),
    },
    version: {
      ...t.typography.caption,
      alignItems: 'center',
      color: 'inherit',
      cursor: 'pointer',
      display: 'flex',
      gap: t.spacing(0.5),
      opacity: 0.35,
      padding: t.spacing(0.5, 2, 1.5),
      transition: 'opacity 150ms',
      '&:hover': {
        opacity: 0.9,
      },
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
    badgeDot: {
      backgroundColor: t.palette.navigation.indicator,
    },
  }
})

// impeccable live session: the rail stays frozen during impeccable live design
// sessions (live.js may take ownership of this DOM at any pick); pairs with
// the authResolved gate below so the frozen render captures resolved auth.
// REMOVE before merge — tracked in the fix-pass ledger.
const Freeze = React.memo(
  ({ children }: { children: React.ReactNode }) => <>{children}</>,
  () => true,
)

function AccountMenu({
  name,
  signOutUrl,
  interactive,
}: {
  name: string
  signOutUrl: string
  interactive: boolean
}) {
  const classes = useStyles()
  const [anchor, setAnchor] = React.useState<HTMLElement | null>(null)
  const open = React.useCallback(
    (e: React.MouseEvent<HTMLElement>) => setAnchor(e.currentTarget),
    [],
  )
  const close = React.useCallback(() => setAnchor(null), [])

  if (!interactive) {
    return (
      <M.List disablePadding>
        <M.ListItem className={classes.identityRow}>
          <M.ListItemIcon className={classes.icon}>
            <OutlinedIcon>account_circle</OutlinedIcon>
          </M.ListItemIcon>
          <M.ListItemText
            primary={name}
            className={classes.wsText}
            primaryTypographyProps={{ noWrap: true }}
          />
        </M.ListItem>
      </M.List>
    )
  }

  return (
    <>
      <M.List disablePadding>
        <M.ListItem
          button
          onClick={open}
          aria-haspopup="true"
          aria-label={`Account: ${name}`}
          className={classes.identityRow}
        >
          <M.ListItemIcon className={classes.icon}>
            <OutlinedIcon>account_circle</OutlinedIcon>
          </M.ListItemIcon>
          <M.ListItemText
            primary={name}
            className={classes.wsText}
            primaryTypographyProps={{ noWrap: true }}
          />
          <M.Icon className={classes.trailing}>expand_more</M.Icon>
        </M.ListItem>
      </M.List>
      <M.MuiThemeProvider theme={style.appTheme}>
        <M.Menu
          anchorEl={anchor}
          open={!!anchor}
          onClose={close}
          keepMounted
          getContentAnchorEl={null}
          anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
          transformOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        >
          <M.MenuItem component={Link} to={signOutUrl} onClick={close}>
            <M.ListItemIcon>
              <OutlinedIcon>meeting_room</OutlinedIcon>
            </M.ListItemIcon>
            Sign Out
          </M.MenuItem>
        </M.Menu>
      </M.MuiThemeProvider>
    </>
  )
}

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
  // clicking into a volume from the home list leads.
  const isHome = !!useRouteMatch({ path: paths.home, exact: true })
  const isBucket = !!useRouteMatch(paths.bucketRoot)
  const volumesActive = isHome || isBucket
  const searchActive = !!useRouteMatch(paths.search)
  const queriesActive = !!useRouteMatch(paths.queries)
  const adminActive = !!useRouteMatch(paths.admin)

  const user = NavMenu.AuthState.match(
    { Ready: ({ user: u }) => u, Loading: () => null, Error: () => null },
    auth,
  )

  const authResolved = NavMenu.AuthState.match(
    { Ready: () => true, Error: () => true, Loading: () => false },
    auth,
  )
  // impeccable live session scaffolding: mount (and freeze) the rail only once
  // auth has resolved, so the frozen render captures the real signed-in state.
  // REMOVE together with Freeze before merging (see Freeze comment above).
  if (!authResolved) return null

  const workspaceContent = user && (
    <>
      <M.ListItemIcon className={classes.icon}>
        <OutlinedIcon>work_outline</OutlinedIcon>
      </M.ListItemIcon>
      <M.ListItemText
        primary={user.role.name}
        className={classes.wsText}
        primaryTypographyProps={{ noWrap: true }}
      />
    </>
  )

  return (
    <>
      {/* impeccable live session: the rail stays frozen during impeccable live
          design sessions (live.js may take ownership of this DOM at any pick);
          pairs with the authResolved gate above so the frozen render captures
          resolved auth. */}
      <Freeze>
        <Rail className={classes.root}>
          <Link to={urls.home()} className={classes.logo}>
            {/* 29px = exactly half of quilt.png's 58px natural height, so the
                mark maps 1:1 to device pixels on 2x displays (no resampling blur). */}
            <Logo height="29px" width="100%" src={settings?.logo?.url} />
          </Link>

          {(user || cfg.mode !== 'LOCAL') && (
            <>
              <div className={classes.sectionLabel}>Workspace</div>
              <div className={classes.workspaceBox}>
                <M.List disablePadding>
                  {user ? (
                    user.roles.length > 1 ? (
                      <M.ListItem
                        button
                        onClick={() => switchRole(user)}
                        className={cx(classes.wsRow, classes.wsRowClickable)}
                      >
                        {workspaceContent}
                        <M.Icon className={classes.trailing}>expand_more</M.Icon>
                      </M.ListItem>
                    ) : (
                      <M.ListItem className={classes.wsRow}>
                        {workspaceContent}
                      </M.ListItem>
                    )
                  ) : (
                    <M.ListItem
                      button
                      component={Link}
                      to={urls.signIn()}
                      className={cx(classes.wsRow, classes.wsRowClickable)}
                    >
                      <M.ListItemIcon className={classes.icon}>
                        <OutlinedIcon>work_outline</OutlinedIcon>
                      </M.ListItemIcon>
                      <M.ListItemText primary="Sign in" />
                    </M.ListItem>
                  )}
                </M.List>
              </div>
            </>
          )}

          <M.List disablePadding className={classes.nav}>
            <M.ListItem
              button
              component={Link}
              to={urls.home()}
              selected={volumesActive}
              className={classes.navItem}
            >
              <M.ListItemIcon className={classes.icon}>
                <OutlinedIcon>storage</OutlinedIcon>
              </M.ListItemIcon>
              <M.ListItemText primary="Volumes" classes={{ primary: classes.navLabel }} />
            </M.ListItem>
            <M.ListItem
              button
              component={Link}
              to={urls.search({})}
              selected={searchActive}
              className={classes.navItem}
            >
              <M.ListItemIcon className={classes.icon}>
                <OutlinedIcon>search</OutlinedIcon>
              </M.ListItemIcon>
              <M.ListItemText primary="Search" classes={{ primary: classes.navLabel }} />
            </M.ListItem>
            <M.ListItem
              button
              component={Link}
              to={urls.queries()}
              selected={queriesActive}
              className={classes.navItem}
            >
              <M.ListItemIcon className={classes.icon}>
                <OutlinedIcon>table_chart</OutlinedIcon>
              </M.ListItemIcon>
              <M.ListItemText primary="Queries" classes={{ primary: classes.navLabel }} />
            </M.ListItem>
            <M.ListItem
              button
              onClick={bookmarks?.show}
              disabled={!bookmarks}
              className={classes.navItem}
            >
              <M.ListItemIcon className={classes.icon}>
                <M.Badge
                  variant="dot"
                  invisible={!bookmarks?.hasUpdates}
                  classes={{ dot: classes.badgeDot }}
                >
                  <OutlinedIcon>bookmarks</OutlinedIcon>
                </M.Badge>
              </M.ListItemIcon>
              <M.ListItemText
                primary="Bookmarks"
                classes={{ primary: classes.navLabel }}
              />
            </M.ListItem>
            {assistant && (
              <M.ListItem button onClick={assistant.show} className={classes.navItem}>
                <M.ListItemIcon className={classes.icon}>
                  <OutlinedIcon>assistant</OutlinedIcon>
                </M.ListItemIcon>
                <M.ListItemText
                  primary="Ask Qurator"
                  classes={{ primary: classes.navLabel }}
                />
              </M.ListItem>
            )}
            {user?.isAdmin && (
              <M.ListItem
                button
                component={Link}
                to={urls.admin()}
                selected={adminActive}
                className={classes.navItem}
              >
                <M.ListItemIcon className={classes.icon}>
                  <OutlinedIcon>security</OutlinedIcon>
                </M.ListItemIcon>
                <M.ListItemText primary="Admin" classes={{ primary: classes.navLabel }} />
              </M.ListItem>
            )}
          </M.List>

          <div className={classes.spacer} />

          {subscription.invalid && (
            <M.List disablePadding dense className={classes.account}>
              <M.ListItem>
                <M.ListItemIcon className={classes.icon}>
                  <OutlinedIcon color="error">warning</OutlinedIcon>
                </M.ListItemIcon>
                <M.ListItemText primary="Unlicensed" />
              </M.ListItem>
            </M.List>
          )}
          {user && (
            <div className={classes.identityBox}>
              <AccountMenu
                name={user.name}
                signOutUrl={urls.signOut()}
                interactive={cfg.mode !== 'LOCAL'}
              />
            </div>
          )}
          <Version />
        </Rail>
      </Freeze>
      <Bookmarks.Drawer />
    </>
  )
}
