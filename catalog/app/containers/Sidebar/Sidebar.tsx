import * as React from 'react'
import cx from 'classnames'
import { Link, useLocation, useRouteMatch } from 'react-router-dom'
import * as M from '@material-ui/core'
import { fade } from '@material-ui/core/styles'

import * as Assistant from 'components/Assistant'
import Logo from 'components/Logo'
import cfg from 'constants/config'
import * as style from 'constants/style'
import * as Bookmarks from 'containers/Bookmarks'
import * as Notifications from 'containers/Notifications'
import * as CatalogSettings from 'utils/CatalogSettings'
import * as NamedRoutes from 'utils/NamedRoutes'
import copyToClipboard from 'utils/clipboard'

import * as NavMenu from './AuthState'
import OutlinedIcon from './OutlinedIcon'
import { Rail } from './Rail'
import useRoleSwitcher from './RoleSwitcher'
import * as Subscription from './Subscription'

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
  // The Focus Ring Rule (DESIGN.md §2), midnight half: this rail's ground IS
  // midnight, so its ring is the amber Indicator. The theme's default ring is
  // Midnight Chassis (correct for light surfaces, invisible here).
  //
  // `&&` doubles the class for specificity 0,3,0, beating the theme's
  // `.MuiButtonBase-root.Mui-focusVisible` (0,2,0) outright. At equal
  // specificity the winner is JSS injection order, which is not a contract
  // worth betting a focus ring on.
  const ring = {
    outline: `2px solid ${t.palette.navigation.indicator}`,
    outlineOffset: -2,
  }
  const focusRing = { '&&:focus-visible': ring }
  return {
    // Sized identically in both modes on purpose: one nav, one set of styles.
    // The viewport-dependent width lives on the Drawer's paper instead, and
    // `maxWidth` lets that paper cap the 256px on a narrow phone.
    root: {
      height: '100%',
      maxWidth: '100%',
      width: t.spacing(32),
    },
    // The overlay copy of the rail. 85vw keeps a strip of the page visible so
    // the scrim reads as dismissable rather than as a new screen. The paper
    // carries the rail's own ground so no white sliver shows at its edge.
    drawerPaper: {
      background: t.palette.primary.main,
      border: 0,
      width: `min(${t.spacing(32)}px, 85vw)`,
    },
    // Match the 64px pseudo-header height so the logo and search bar align.
    // minHeight, not height: at 200% zoom the row has to be able to grow rather
    // than clip the mark. (The bar it aligns with grows too, though not in
    // lockstep -- the logo is a fixed-px image, so exact registration is a
    // 100%-zoom property.)
    logo: {
      alignItems: 'center',
      display: 'flex',
      minHeight: 64,
      padding: t.spacing(0, 2),
      ...focusRing,
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
      ...focusRing,
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
    // minHeight, not height: 44px is the touch-target floor, not a ceiling. A
    // hard height clips the label when text scales on its own (text-only zoom,
    // or a user minimum font size) rather than letting the row grow.
    identityRow: {
      minHeight: 44,
      padding: t.spacing(0, 1.5, 0, 2),
      ...iconCol,
      ...rowHover,
      ...focusRing,
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
      // See identityRow: 44px is the touch-target floor, not a ceiling.
      minHeight: 44,
      padding: t.spacing(0, 1.5, 0, 2),
      ...iconCol,
      ...rowHover,
      ...focusRing,
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
      opacity: 0.55,
      padding: t.spacing(0.5, 2, 1.5),
      transition: 'opacity 150ms',
      '&:hover': {
        opacity: 0.9,
      },
      '&:hover $copyIcon': {
        visibility: 'visible',
      },
      '&&:focus-visible': {
        ...ring,
        opacity: 0.9,
      },
    },
    versionText: {
      fontFamily: t.typography.monospace.fontFamily,
      minWidth: 0,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    },
    copyIcon: {
      fontSize: t.typography.body2.fontSize,
      marginLeft: t.spacing(0.5),
      visibility: 'hidden',
    },
    badgeDot: {
      backgroundColor: t.palette.navigation.indicator,
    },
  }
})

// The rail is a permanent column at `md` and up and a dismissable overlay below
// it -- there is no room for a 256px column beside the content on a phone. The
// markup is identical either way, so there is one nav and one set of
// active-route state rather than two that can disagree.
//
// Temporary is the right Drawer variant here beyond the visuals: it unmounts the
// rail while closed, so the compact layout has no offscreen tab stops, and it
// brings the scrim, focus trap, and Escape-to-close with it.
function NavShell({
  compact,
  open,
  onClose,
  paperClass,
  children,
}: {
  compact: boolean
  open: boolean
  onClose?: () => void
  paperClass: string
  children: React.ReactNode
}) {
  if (!compact) return <>{children}</>
  return (
    <M.Drawer anchor="left" open={open} onClose={onClose} classes={{ paper: paperClass }}>
      {children}
    </M.Drawer>
  )
}

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
  // Plain div + role="button" rather than M.ButtonBase: ButtonBase's root
  // defaults to `display: inline-flex; justify-content: center`, which would
  // fight this row's own `display: flex` (default justify-content: flex-start,
  // relied on to keep the text flush-left and the copy icon flush-right).
  // role/tabIndex/onKeyDown gets the same keyboard semantics without risking
  // that cascade conflict.
  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        handleCopy()
      }
    },
    [handleCopy],
  )
  if (!cfg.stackVersion) return null
  return (
    <div
      className={classes.version}
      onClick={handleCopy}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      title="Copy Platform release version to clipboard"
    >
      <span className={classes.versionText}>Version: {cfg.stackVersion}</span>
      <OutlinedIcon className={classes.copyIcon}>content_copy</OutlinedIcon>
    </div>
  )
}

export interface SidebarProps {
  // Below `md` the rail becomes an overlay; the Layout owns that decision (and
  // the open state) because the header's menu button is the thing that toggles
  // it, and the two must not disagree about which mode they're in.
  compact?: boolean
  open?: boolean
  onClose?: () => void
}

export function Sidebar({ compact = false, open = false, onClose }: SidebarProps) {
  const classes = useStyles()
  const { urls, paths } = NamedRoutes.use()
  const settings = CatalogSettings.use()
  const subscription = Subscription.useState()
  const bookmarks = Bookmarks.use()
  const assistant = Assistant.Model.useAssistantAPI()
  const auth = NavMenu.useAuthState()
  const switchRole = useRoleSwitcher()

  // Volumes also owns bucket-browsing routes (`/b/*`), since that's where
  // clicking into a volume from the list leads. `/` counts too: with
  // the `front-door` preview feature off it renders the same list this item
  // points at.
  //
  // "Volume" is the user-facing word; "bucket" stays the internal one (routes,
  // the search model's filter, useCurrentBucket). That split is deliberate --
  // renaming the plumbing would put Volumes in the chrome while URLs, filters
  // and error messages still said bucket.
  const isHome = !!useRouteMatch({ path: paths.home, exact: true })
  const isBucketList = !!useRouteMatch({ path: paths.buckets, exact: true })
  const isBucket = !!useRouteMatch(paths.bucketRoot)
  const volumesActive = isHome || isBucketList || isBucket
  const searchActive = !!useRouteMatch(paths.search)
  const queriesActive = !!useRouteMatch(paths.queries)
  const adminActive = !!useRouteMatch(paths.admin)

  // When already on the search page, "Search" keeps the live query string
  // (q, filters, ordering) instead of resetting to bare /search -- the query
  // field lives in the header now, and a rail click that silently wiped an
  // in-progress search would have no undo. From anywhere else it's the plain
  // entry point.
  const location = useLocation()
  const searchTo = searchActive ? location.pathname + location.search : urls.search({})

  // The overlay copy of the rail covers the page it just navigated to, so it has
  // to dismiss itself on arrival. Keyed on the URL rather than on the click so
  // browser back and programmatic navigation dismiss it too.
  const locationKey = location.pathname + location.search
  React.useEffect(() => {
    if (onClose) onClose()
  }, [locationKey, onClose])

  const user = NavMenu.AuthState.match(
    { Ready: ({ user: u }) => u, Loading: () => null, Error: () => null },
    auth,
  )

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
      <NavShell
        compact={compact}
        open={open}
        onClose={onClose}
        paperClass={classes.drawerPaper}
      >
        <Rail className={classes.root}>
          <Link to={urls.home()} className={classes.logo}>
            {/* Default branding is the full quilt.bio wordmark: white text plus
                the coral dot, which reads on the midnight rail. The rail slot is
                wide, so the brand should read as a name rather than a dot. A
                customer's own logo still renders via `src` as before. */}
            <Logo
              height="32px"
              width="100%"
              src={settings?.logo?.url}
              variant="wordmark"
            />
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
              to={urls.buckets()}
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
              to={searchTo}
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
      </NavShell>
      <Bookmarks.Drawer />
    </>
  )
}
