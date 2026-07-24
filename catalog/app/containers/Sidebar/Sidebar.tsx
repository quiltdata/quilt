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
  // Collapsed rail width: one 44px row centered in a 72px column, matching the
  // nav-row height rhythm. Expanded stays 256px (spacing(32)).
  const COLLAPSED = t.spacing(9)
  return {
    root: {
      width: t.spacing(32),
      // Width is animated deliberately (not transform): the rail reflows the
      // main content column, which must reclaim the freed space as the rail
      // narrows — a transform would slide the rail but leave a gap. It's one
      // short transition on a single element off the interaction hot path.
      transition: t.transitions.create('width', {
        duration: t.transitions.duration.shorter,
      }),
    },
    rootCollapsed: {
      width: COLLAPSED,
    },
    // Match the 64px pseudo-header height so the logo and search bar align.
    logo: {
      alignItems: 'center',
      display: 'flex',
      height: 64,
      padding: t.spacing(0, 2),
      // The logo row's padding snaps between states rather than tweening: the
      // perceptual settle of the collapse is carried by the logo crossfade
      // (opacity) and the label fade/slide (transform) — both compositor-only.
      // Animating padding here would add a per-frame layout pass on app-bar
      // chrome for a 12px shift the eye doesn't track behind those; not worth
      // the thrash. The one deliberately-animated layout property is the rail's
      // own width (see `root`), which has to reflow the content column.
      '&:focus-visible': {
        outline: `2px solid ${t.palette.navigation.indicator}`,
        outlineOffset: -2,
      },
    },
    // Collapsed: keep the logomark + chevron paired on one row (mirroring the
    // expanded wordmark + chevron), centered as a unit in the narrow rail. Tight
    // side padding buys room for both in the 72px column.
    logoCollapsed: {
      gap: t.spacing(0.25),
      justifyContent: 'center',
      padding: t.spacing(0, 0.5),
    },
    // The brand link fills the row so the wordmark aligns left and the collapse
    // control can sit at the right edge; collapsed it shrinks to the logomark.
    // It's the positioning context for the crossfaded logo variants stacked
    // inside it, and clips (overflow: hidden) so the wordmark wipes out cleanly
    // as the rail narrows instead of overflowing the 72px column.
    logoLink: {
      alignItems: 'center',
      display: 'flex',
      flexGrow: 1,
      height: 32,
      minWidth: 0,
      overflow: 'hidden',
      position: 'relative',
    },
    // Collapsed: don't stretch the link — the logomark shrinks to its 32px so
    // the chevron can sit directly beside it, the pair centered in the rail.
    logoLinkCollapsed: {
      flexGrow: 0,
      width: 32,
    },
    // Both logo variants occupy the same box and crossfade so the swap settles
    // on the rail's clock rather than hard-cutting at frame 0. The wordmark is
    // the flow element (sets the row's natural width when expanded); the icon
    // is overlaid, centered, and fades in only when collapsed. Motion is
    // decoration on chrome, so reduced-motion users get the instant swap.
    logoVariant: {
      '@media (prefers-reduced-motion: no-preference)': {
        transition: t.transitions.create(['opacity'], {
          duration: t.transitions.duration.shorter,
        }),
      },
    },
    logoIcon: {
      left: 0,
      position: 'absolute',
      top: 0,
    },
    logoDim: {
      opacity: 0,
    },
    // The collapse control sits in the logo row next to the brand — right edge
    // when expanded (next to the wordmark), directly beside the "Q" when
    // collapsed — so the toggle keeps the same relationship to the logo in
    // both states, matching the quilt.bio lockup.
    collapseBtn: {
      color: fade(t.palette.common.white, 0.55),
      '&:hover': {
        backgroundColor: fade(t.palette.common.white, 0.08),
        color: fade(t.palette.common.white, 0.9),
      },
    },
    // Expanded only: shove the collapse control to the right edge of the logo
    // row so it trails the wordmark.
    collapseBtnExpanded: {
      marginLeft: 'auto',
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
      '&:focus-visible': {
        outline: `2px solid ${t.palette.navigation.indicator}`,
        outlineOffset: -2,
      },
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
    // Collapsed: shed the filled box so the account icon reads as a bare row,
    // consistent with the collapsed nav.
    identityCollapsed: {
      backgroundColor: 'transparent',
    },
    identityRow: {
      height: 44,
      padding: t.spacing(0, 1.5, 0, 2),
      ...iconCol,
      ...rowHover,
      '&:focus-visible': {
        outline: `2px solid ${t.palette.navigation.indicator}`,
        outlineOffset: -2,
      },
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
      '&:focus-visible': {
        outline: `2px solid ${t.palette.navigation.indicator}`,
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
    // Labels are conditionally mounted (so they don't reserve width in the
    // collapsed rail), which means expanding pops them in at full opacity at
    // frame 0 — ahead of the rail finishing its widen. A one-shot fade+slide on
    // mount lets the text arrive on the rail's clock instead of snapping. Chrome
    // decoration, so reduced-motion users get the label with no entrance (the
    // animation only attaches inside the no-preference media query).
    '@keyframes labelIn': {
      '0%': {
        opacity: 0,
        transform: `translateX(-${t.spacing(1)}px)`,
      },
      '100%': {
        opacity: 1,
        transform: 'translateX(0)',
      },
    },
    labelReveal: {
      '@media (prefers-reduced-motion: no-preference)': {
        animation: `$labelIn ${t.transitions.duration.shorter}ms ${t.transitions.easing.easeOut}`,
      },
    },
    // Collapsed rows: square the row to its icon, center it, and drop the label
    // gutter so the icon lands dead-center in the 72px rail. The active amber
    // bracket still reads at the left edge.
    rowCollapsed: {
      justifyContent: 'center',
      padding: t.spacing(0, 1.5),
      '& $icon': {
        minWidth: 0,
      },
    },
    navCollapsed: {
      // Tighten the horizontal inset so centered rows have symmetric margins.
      paddingLeft: t.spacing(1),
      paddingRight: t.spacing(1),
    },
    // Hidden but kept mounted (no layout thrash on toggle); labels simply
    // collapse to zero width when the rail closes.
    hidden: {
      display: 'none',
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
      '&:focus-visible': {
        opacity: 0.9,
        outline: `2px solid ${t.palette.navigation.indicator}`,
        outlineOffset: -2,
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

// impeccable live session: the rail stays frozen during impeccable live design
// sessions (live.js may take ownership of this DOM at any pick); pairs with
// the authResolved gate below so the frozen render captures resolved auth.
// `sig` is a re-render escape hatch: genuine intentional state (e.g. the
// collapse toggle) bumps it so the frozen subtree updates, while incidental
// parent re-renders during a live pick are still absorbed.
// REMOVE before merge — tracked in the fix-pass ledger.
const Freeze = React.memo(
  ({ children }: { children: React.ReactNode; sig?: unknown }) => <>{children}</>,
  (prev, next) => prev.sig === next.sig,
)

const COLLAPSE_KEY = 'quilt.sidebar.collapsed'

// Collapsing the rail is a workspace preference, so it persists across reloads
// and navigation (localStorage) rather than resetting on every mount.
function useCollapsed(): [boolean, () => void] {
  const [collapsed, setCollapsed] = React.useState<boolean>(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === '1'
    } catch (e) {
      return false
    }
  })
  const toggle = React.useCallback(() => {
    setCollapsed((c) => {
      const next = !c
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0')
      } catch (e) {
        // ignore storage failures (private mode, quota) — preference is best-effort
      }
      return next
    })
  }, [])
  return [collapsed, toggle]
}

function AccountMenu({
  name,
  signOutUrl,
  interactive,
  collapsed = false,
}: {
  name: string
  signOutUrl: string
  interactive: boolean
  collapsed?: boolean
}) {
  const classes = useStyles()
  const [anchor, setAnchor] = React.useState<HTMLElement | null>(null)
  const open = React.useCallback(
    (e: React.MouseEvent<HTMLElement>) => setAnchor(e.currentTarget),
    [],
  )
  const close = React.useCallback(() => setAnchor(null), [])

  if (!interactive) {
    const row = (
      <M.List disablePadding>
        <M.ListItem
          className={cx(classes.identityRow, collapsed && classes.rowCollapsed)}
        >
          <M.ListItemIcon className={classes.icon}>
            <OutlinedIcon>account_circle</OutlinedIcon>
          </M.ListItemIcon>
          {!collapsed && (
            <M.ListItemText
              primary={name}
              className={cx(classes.wsText, classes.labelReveal)}
              primaryTypographyProps={{ noWrap: true }}
            />
          )}
        </M.ListItem>
      </M.List>
    )
    return collapsed ? (
      <M.Tooltip title={name} placement="right">
        {row}
      </M.Tooltip>
    ) : (
      row
    )
  }

  return (
    <>
      <M.List disablePadding>
        <M.Tooltip title={collapsed ? name : ''} placement="right">
          <M.ListItem
            button
            onClick={open}
            aria-haspopup="true"
            aria-label={`Account: ${name}`}
            className={cx(classes.identityRow, collapsed && classes.rowCollapsed)}
          >
            <M.ListItemIcon className={classes.icon}>
              <OutlinedIcon>account_circle</OutlinedIcon>
            </M.ListItemIcon>
            {!collapsed && (
              <>
                <M.ListItemText
                  primary={name}
                  className={cx(classes.wsText, classes.labelReveal)}
                  primaryTypographyProps={{ noWrap: true }}
                />
                <M.Icon className={classes.trailing}>expand_more</M.Icon>
              </>
            )}
          </M.ListItem>
        </M.Tooltip>
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

// A single primary-nav row. Collapsed, it centers the icon, drops the label,
// and grows a hover tooltip so the destination is still discoverable when the
// text is gone.
function NavRow({
  icon,
  label,
  collapsed,
  selected,
  disabled,
  to,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  collapsed: boolean
  selected?: boolean
  disabled?: boolean
  to?: string
  onClick?: () => void
}) {
  const classes = useStyles()
  const linkProps = to ? { component: Link, to } : { onClick }
  const row = (
    <M.ListItem
      button
      selected={selected}
      disabled={disabled}
      className={cx(classes.navItem, collapsed && classes.rowCollapsed)}
      aria-label={collapsed ? label : undefined}
      {...linkProps}
    >
      <M.ListItemIcon className={classes.icon}>{icon}</M.ListItemIcon>
      {!collapsed && (
        <M.ListItemText
          primary={label}
          className={classes.labelReveal}
          classes={{ primary: classes.navLabel }}
        />
      )}
    </M.ListItem>
  )
  if (!collapsed) return row
  return (
    <M.Tooltip title={label} placement="right">
      {/* Tooltip needs a DOM-reachable child; a disabled ListItem swallows events,
          so wrap it so hover still fires. */}
      <span>{row}</span>
    </M.Tooltip>
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

export function Sidebar() {
  const classes = useStyles()
  const { urls, paths } = NamedRoutes.use()
  const settings = CatalogSettings.use()
  const subscription = Subscription.useState()
  const bookmarks = Bookmarks.use()
  const assistant = Assistant.Model.useAssistantAPI()
  const auth = NavMenu.useAuthState()
  const switchRole = useRoleSwitcher()
  const [collapsed, toggleCollapsed] = useCollapsed()
  // A customer's own logo is a wide lockup — it has no square icon variant, so
  // collapsing would clip it. Keep the rail open when custom branding is set.
  const canCollapse = !settings?.logo?.url
  const isCollapsed = collapsed && canCollapse

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
      <Freeze sig={isCollapsed}>
        <Rail className={cx(classes.root, isCollapsed && classes.rootCollapsed)}>
          <div className={cx(classes.logo, isCollapsed && classes.logoCollapsed)}>
            <Link
              to={urls.home()}
              className={cx(classes.logoLink, isCollapsed && classes.logoLinkCollapsed)}
              aria-label="quilt.bio home"
            >
              {/* Default branding shows the full quilt.bio wordmark on the dark
                  rail (white text + coral dot reads on the indigo chassis).
                  Collapsed, it crossfades to the square "Q" logomark. A
                  customer's own logo (which can't collapse) still renders via
                  src as before. */}
              {settings?.logo?.url ? (
                <Logo height="32px" width="100%" src={settings.logo.url} />
              ) : (
                <>
                  <Logo
                    className={cx(classes.logoVariant, isCollapsed && classes.logoDim)}
                    height="32px"
                    width="100%"
                    variant="wordmark"
                  />
                  <Logo
                    className={cx(
                      classes.logoVariant,
                      classes.logoIcon,
                      !isCollapsed && classes.logoDim,
                    )}
                    height="32px"
                    width="32px"
                    variant="icon"
                  />
                </>
              )}
            </Link>
            {canCollapse && (
              <M.Tooltip
                title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                placement="right"
              >
                <M.IconButton
                  size="small"
                  className={cx(
                    classes.collapseBtn,
                    !isCollapsed && classes.collapseBtnExpanded,
                  )}
                  onClick={toggleCollapsed}
                  aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                >
                  <M.Icon fontSize="small">
                    {isCollapsed ? 'chevron_right' : 'chevron_left'}
                  </M.Icon>
                </M.IconButton>
              </M.Tooltip>
            )}
          </div>

          {!isCollapsed && (user || cfg.mode !== 'LOCAL') && (
            <div className={classes.labelReveal}>
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
            </div>
          )}

          <M.List
            disablePadding
            className={cx(classes.nav, isCollapsed && classes.navCollapsed)}
          >
            <NavRow
              icon={<OutlinedIcon>storage</OutlinedIcon>}
              label="Volumes"
              collapsed={isCollapsed}
              selected={volumesActive}
              to={urls.home()}
            />
            <NavRow
              icon={<OutlinedIcon>search</OutlinedIcon>}
              label="Search"
              collapsed={isCollapsed}
              selected={searchActive}
              to={urls.search({})}
            />
            <NavRow
              icon={<OutlinedIcon>table_chart</OutlinedIcon>}
              label="Queries"
              collapsed={isCollapsed}
              selected={queriesActive}
              to={urls.queries()}
            />
            <NavRow
              icon={
                <M.Badge color="primary" variant="dot" invisible={!bookmarks?.hasUpdates}>
                  <OutlinedIcon>bookmarks</OutlinedIcon>
                </M.Badge>
              }
              label="Bookmarks"
              collapsed={isCollapsed}
              disabled={!bookmarks}
              onClick={bookmarks?.show}
            />
            {assistant && (
              <NavRow
                icon={<OutlinedIcon>assistant</OutlinedIcon>}
                label="Qurator"
                collapsed={isCollapsed}
                onClick={assistant.show}
              />
            )}
            {user?.isAdmin && (
              <NavRow
                icon={<OutlinedIcon>security</OutlinedIcon>}
                label="Admin"
                collapsed={isCollapsed}
                selected={adminActive}
                to={urls.admin()}
              />
            )}
          </M.List>

          <div className={classes.spacer} />

          {subscription.invalid &&
            (isCollapsed ? (
              <M.Tooltip title="Unlicensed" placement="right">
                <M.List disablePadding dense className={classes.account}>
                  <M.ListItem className={classes.rowCollapsed}>
                    <M.ListItemIcon className={classes.icon}>
                      <OutlinedIcon color="error">warning</OutlinedIcon>
                    </M.ListItemIcon>
                  </M.ListItem>
                </M.List>
              </M.Tooltip>
            ) : (
              <M.List disablePadding dense className={classes.account}>
                <M.ListItem>
                  <M.ListItemIcon className={classes.icon}>
                    <OutlinedIcon color="error">warning</OutlinedIcon>
                  </M.ListItemIcon>
                  <M.ListItemText primary="Unlicensed" />
                </M.ListItem>
              </M.List>
            ))}
          {user && (
            <div
              className={cx(
                classes.identityBox,
                isCollapsed && classes.identityCollapsed,
              )}
            >
              <AccountMenu
                name={user.name}
                signOutUrl={urls.signOut()}
                interactive={cfg.mode !== 'LOCAL'}
                collapsed={isCollapsed}
              />
            </div>
          )}
          {!isCollapsed && (
            <div className={classes.labelReveal}>
              <Version />
            </div>
          )}
        </Rail>
      </Freeze>
      <Bookmarks.Drawer />
    </>
  )
}
