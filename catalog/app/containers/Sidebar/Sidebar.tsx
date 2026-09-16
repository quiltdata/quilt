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
import isTypingTarget from 'utils/isTypingTarget'

import * as NavMenu from './AuthState'
import OutlinedIcon from './OutlinedIcon'
import { Rail } from './Rail'
import useRoleSwitcher from './RoleSwitcher'
import * as Subscription from './Subscription'
import useCollapsed from './useCollapsed'

const NAV_ID = 'sidebar-nav'

// Motion is decoration on chrome: every transition attaches only inside this
// query, so reduced-motion users get the instant swap.
const MOTION = '@media (prefers-reduced-motion: no-preference)'

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
  // Collapsed rail: one 44px row centered in a 72px column. The row keeps its
  // markup and only changes inset: 18px lands the 20px glyph dead-center in
  // the 56px row, 2px from where the expanded 16px inset already had it, so
  // the icons hold their axis while the rail's edge sweeps in around them.
  const COLLAPSED = t.spacing(9)
  const collapsedRow = {
    overflow: 'hidden',
    padding: t.spacing(0, 0, 0, 2.25),
    '& $icon': {
      minWidth: 0,
    },
  }
  const widthTransition = t.transitions.create('width', {
    duration: t.transitions.duration.shorter,
    easing: t.transitions.easing.easeOut,
  })
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
      // Width is the one animated layout property, deliberately: the rail has
      // to reflow the content column so the page reclaims the freed space as
      // the rail narrows. A transform would slide the rail and leave a gap.
      [MOTION]: {
        transition: widthTransition,
      },
    },
    rootCollapsed: {
      width: COLLAPSED,
    },
    // The overlay copy of the rail. 85vw keeps a strip of the page visible so
    // the scrim reads as dismissable rather than as a new screen. The paper
    // carries the rail's own ground so no white sliver shows at its edge.
    drawerPaper: {
      background: t.palette.primary.main,
      border: 0,
      width: `min(${t.spacing(32)}px, 85vw)`,
    },
    // The brand row holds the home link and the collapse control. Expanded
    // they share the 64px row; collapsed the control drops beneath the mark so
    // the mark can sit centered on the icon axis.
    brand: {
      alignItems: 'center',
      display: 'flex',
      paddingRight: t.spacing(1),
    },
    // 6px, not a spacing step: with the 30px control beneath the 64px mark it
    // puts the first nav row at the same y (160px) as the expanded rail, so
    // the rows don't hop on toggle. That registration assumes the Workspace
    // section is there to give the height back; LOCAL mode with no user
    // omits it and takes a 36px hop.
    brandCollapsed: {
      flexDirection: 'column',
      paddingBottom: 6,
      paddingRight: 0,
    },
    // Match the 64px pseudo-header height so the logo and search bar align.
    // minHeight, not height: at 200% zoom the row has to be able to grow rather
    // than clip the mark. (The bar it aligns with grows too, though not in
    // lockstep -- the logo is a fixed-px image, so exact registration is a
    // 100%-zoom property.)
    logo: {
      alignItems: 'center',
      display: 'flex',
      flexGrow: 1,
      minHeight: 64,
      minWidth: 0,
      padding: t.spacing(0, 2),
      ...focusRing,
    },
    logoCollapsed: {
      flexGrow: 0,
      justifyContent: 'center',
      padding: 0,
      width: '100%',
    },
    // Both brand variants occupy one box and crossfade, so the swap settles on
    // the rail's clock instead of hard-cutting at frame 0. The wordmark is the
    // flow element; the mark is overlaid and fades in only when collapsed. The
    // box clips so the wordmark wipes out as the rail narrows instead of
    // overflowing the column.
    logoStack: {
      height: 32,
      overflow: 'hidden',
      position: 'relative',
      width: '100%',
    },
    logoStackCollapsed: {
      width: 32,
    },
    logoVariant: {
      [MOTION]: {
        transition: t.transitions.create('opacity', {
          duration: t.transitions.duration.shorter,
        }),
      },
    },
    logoMark: {
      left: 0,
      position: 'absolute',
      top: 0,
    },
    logoDim: {
      opacity: 0,
    },
    // A customer's lockup has no square variant: collapsed it gets the whole
    // column (Logo fits it inside by height and width) rather than the mark's
    // 32px box, since a wide lockup squeezed into a square is a smear.
    logoStackCustomCollapsed: {
      width: `calc(100% - ${t.spacing(2)}px)`,
    },
    toggle: {
      color: t.palette.navigation.textMuted,
      [MOTION]: {
        transition: t.transitions.create(['color', 'background-color'], {
          duration: 150,
        }),
      },
      '&:hover': {
        backgroundColor: fade(t.palette.common.white, 0.08),
        color: t.palette.navigation.text,
      },
      ...focusRing,
    },
    // Keycap in the toggle's tooltip: the search band's `/` hint, on a dark
    // ground.
    keycap: {
      border: `1px solid ${fade(t.palette.common.white, 0.4)}`,
      borderRadius: 2,
      display: 'inline-block',
      fontFamily: t.typography.monospace.fontFamily,
      lineHeight: '14px',
      marginLeft: t.spacing(0.75),
      padding: '0 4px',
    },
    workspaceBox: {
      ...box,
      margin: t.spacing(0, 1, 1),
      [MOTION]: {
        transition: t.transitions.create('background-color', {
          duration: t.transitions.duration.shorter,
        }),
      },
    },
    icon: {
      color: 'inherit',
      '& .material-icons': {
        fontSize: 20,
      },
    },
    // Text that only exists in the expanded rail. It stays mounted so nothing
    // remounts on toggle: collapsed it fades and slides under the row's clip,
    // and it stops flexing so the row's shrink never ellipsizes it mid-fade.
    // Out is quick (gone before the rail's edge reaches it); in is delayed so
    // the words arrive once the rail has opened room for them.
    label: {
      [MOTION]: {
        transition: t.transitions.create(['opacity', 'transform'], {
          duration: t.transitions.duration.shorter,
          easing: t.transitions.easing.easeOut,
          delay: 60,
        }),
      },
    },
    labelHidden: {
      flex: '0 0 auto',
      opacity: 0,
      transform: `translateX(-${t.spacing(1)}px)`,
      [MOTION]: {
        transition: t.transitions.create(['opacity', 'transform'], {
          duration: 100,
          easing: t.transitions.easing.easeIn,
        }),
      },
    },
    // Rows that exist only in the expanded rail (the section label, the
    // version readout) close up through a 1fr -> 0fr grid track: it animates
    // to the content's real height, so text scaling can never overrun a
    // ceiling, and the inner box (min-height 0) is what actually shrinks.
    // Padding stays on the child so the closed track can reach zero.
    fold: {
      display: 'grid',
      gridTemplateRows: '1fr',
      [MOTION]: {
        transition: t.transitions.create(['grid-template-rows', 'opacity'], {
          duration: t.transitions.duration.shorter,
        }),
      },
    },
    foldClosed: {
      gridTemplateRows: '0fr',
      opacity: 0,
    },
    foldInner: {
      minHeight: 0,
      overflow: 'hidden',
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
      minHeight: 44,
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
      [MOTION]: {
        transition: t.transitions.create('background-color', {
          duration: t.transitions.duration.shorter,
        }),
      },
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
    // Tooltip needs a DOM-reachable child; a disabled ListItem swallows events.
    tipAnchor: {
      display: 'block',
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
    // Same 8px inset as the nav list so the warning glyph shares the icon axis.
    account: {
      padding: t.spacing(0.5, 1),
    },
    unlicensedRow: {
      minHeight: 44,
      padding: t.spacing(0, 1.5, 0, 2),
      ...iconCol,
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
      [MOTION]: {
        transition: t.transitions.create('opacity', { duration: 150 }),
      },
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
    // Last on purpose: these override the inset, icon column and ground of
    // every row and box class above them, and at equal specificity JSS order
    // is the tiebreak.
    rowCollapsed: collapsedRow,
    // Collapsed, the boxed rows shed their ground and read as bare icon rows,
    // one vocabulary with the nav beneath.
    boxCollapsed: {
      backgroundColor: 'transparent',
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

// A block that closes to zero height when the rail folds (see `fold` styles).
function Fold({ closed, children }: { closed: boolean; children: React.ReactNode }) {
  const classes = useStyles()
  return (
    <div className={cx(classes.fold, closed && classes.foldClosed)} aria-hidden={closed}>
      <div className={classes.foldInner}>{children}</div>
    </div>
  )
}

// Collapsed rows keep their label in the DOM (faded, under the row's clip) so
// the accessible name never changes; the tooltip is the sighted user's copy of
// it. An empty title is MUI's "no tooltip", so the wrapper is unconditional
// and the row never remounts on toggle.
function RowTip({
  collapsed,
  title,
  children,
}: {
  collapsed: boolean
  title: string
  children: React.ReactElement
}) {
  return (
    <M.Tooltip
      arrow
      placement="right"
      title={collapsed ? title : ''}
      enterDelay={300}
      enterNextDelay={100}
    >
      {children}
    </M.Tooltip>
  )
}

interface NavRowProps {
  icon: React.ReactNode
  label: string
  collapsed: boolean
  selected?: boolean
  disabled?: boolean
  to?: string
  onClick?: () => void
}

// A single primary-nav row. Collapsed it drops to its icon (label faded, not
// unmounted) and grows a tooltip so the destination stays discoverable.
function NavRow({
  icon,
  label,
  collapsed,
  selected = false,
  disabled = false,
  to,
  onClick,
}: NavRowProps) {
  const classes = useStyles()
  const className = cx(classes.navItem, collapsed && classes.rowCollapsed)
  const content = (
    <>
      <M.ListItemIcon className={classes.icon}>{icon}</M.ListItemIcon>
      <M.ListItemText
        primary={label}
        className={cx(classes.label, collapsed && classes.labelHidden)}
        classes={{ primary: classes.navLabel }}
      />
    </>
  )
  // Two elements, not one with a conditional `component`: ListItem's
  // overloads won't type `to` against an undefined component.
  const row = to ? (
    <M.ListItem button component={Link} to={to} selected={selected} className={className}>
      {content}
    </M.ListItem>
  ) : (
    <M.ListItem
      button
      onClick={onClick}
      disabled={disabled}
      selected={selected}
      className={className}
    >
      {content}
    </M.ListItem>
  )
  return (
    <RowTip collapsed={collapsed} title={label}>
      {disabled ? <span className={classes.tipAnchor}>{row}</span> : row}
    </RowTip>
  )
}

function AccountMenu({
  name,
  signOutUrl,
  interactive,
  collapsed,
}: {
  name: string
  signOutUrl: string
  interactive: boolean
  collapsed: boolean
}) {
  const classes = useStyles()
  const [anchor, setAnchor] = React.useState<HTMLElement | null>(null)
  const open = React.useCallback(
    (e: React.MouseEvent<HTMLElement>) => setAnchor(e.currentTarget),
    [],
  )
  const close = React.useCallback(() => setAnchor(null), [])
  const rowClass = cx(classes.identityRow, collapsed && classes.rowCollapsed)
  const textClass = cx(classes.wsText, classes.label, collapsed && classes.labelHidden)

  if (!interactive) {
    return (
      <M.List disablePadding>
        <RowTip collapsed={collapsed} title={name}>
          <M.ListItem className={rowClass}>
            <M.ListItemIcon className={classes.icon}>
              <OutlinedIcon>account_circle</OutlinedIcon>
            </M.ListItemIcon>
            <M.ListItemText
              primary={name}
              className={textClass}
              primaryTypographyProps={{ noWrap: true }}
            />
          </M.ListItem>
        </RowTip>
      </M.List>
    )
  }

  return (
    <>
      <M.List disablePadding>
        <RowTip collapsed={collapsed} title={name}>
          <M.ListItem
            button
            onClick={open}
            aria-haspopup="true"
            aria-label={`Account: ${name}`}
            className={rowClass}
          >
            <M.ListItemIcon className={classes.icon}>
              <OutlinedIcon>account_circle</OutlinedIcon>
            </M.ListItemIcon>
            <M.ListItemText
              primary={name}
              className={textClass}
              primaryTypographyProps={{ noWrap: true }}
            />
            <M.Icon
              className={cx(
                classes.trailing,
                classes.label,
                collapsed && classes.labelHidden,
              )}
            >
              expand_more
            </M.Icon>
          </M.ListItem>
        </RowTip>
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

function Version({ collapsed }: { collapsed: boolean }) {
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
  // The version is a readout, not a destination: collapsed it closes up
  // rather than becoming an icon row nobody could read, and leaves the tab
  // order with it.
  return (
    <Fold closed={collapsed}>
      <div
        className={classes.version}
        onClick={handleCopy}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={collapsed ? -1 : 0}
        aria-hidden={collapsed}
        title="Copy Platform release version to clipboard"
      >
        <span className={classes.versionText}>Version: {cfg.stackVersion}</span>
        <OutlinedIcon className={classes.copyIcon}>content_copy</OutlinedIcon>
      </div>
    </Fold>
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

// The collapse control: a chevron beside the brand. `[` toggles it from
// anywhere except while typing, the same guard the search band's `/` uses.
function CollapseToggle({
  collapsed,
  onToggle,
}: {
  collapsed: boolean
  onToggle: () => void
}) {
  const classes = useStyles()
  React.useEffect(() => {
    const onKeyDown = (evt: KeyboardEvent) => {
      if (evt.key !== '[') return
      // Cmd/Ctrl+[ is the browser's (or someone else's). Alt stays allowed:
      // on German, Nordic and Spanish layouts `[` is only reachable as Option+5
      // or AltGr+8, which report altKey (and, for AltGr, ctrlKey too).
      if (evt.metaKey || (evt.ctrlKey && !evt.altKey)) return
      // A held key auto-repeats; a toggle must not strobe.
      if (evt.repeat || isTypingTarget(evt)) return
      evt.preventDefault()
      onToggle()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onToggle])

  const label = collapsed ? 'Expand sidebar' : 'Collapse sidebar'
  return (
    <M.Tooltip
      arrow
      placement="right"
      title={
        <>
          {label}
          <kbd className={classes.keycap}>[</kbd>
        </>
      }
    >
      <M.IconButton
        size="small"
        className={classes.toggle}
        onClick={onToggle}
        aria-label={label}
        aria-keyshortcuts="["
        aria-expanded={!collapsed}
        aria-controls={NAV_ID}
      >
        <M.Icon fontSize="small">{collapsed ? 'chevron_right' : 'chevron_left'}</M.Icon>
      </M.IconButton>
    </M.Tooltip>
  )
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
  const [collapsedPref, toggleCollapsed] = useCollapsed()
  // The overlay rail (compact shell) is always the full rail: there is nothing
  // beside it to make room for. The preference survives underneath and applies
  // again once the viewport is wide enough for a column.
  const canCollapse = !compact
  const collapsed = canCollapse && collapsedPref

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

  const labelClass = cx(classes.label, collapsed && classes.labelHidden)
  const wsRowClass = cx(classes.wsRow, collapsed && classes.rowCollapsed)

  const workspaceContent = user && (
    <>
      <M.ListItemIcon className={classes.icon}>
        <OutlinedIcon>work_outline</OutlinedIcon>
      </M.ListItemIcon>
      <M.ListItemText
        primary={user.role.name}
        className={cx(classes.wsText, labelClass)}
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
        <Rail className={cx(classes.root, collapsed && classes.rootCollapsed)}>
          <div className={cx(classes.brand, collapsed && classes.brandCollapsed)}>
            <Link
              to={urls.home()}
              className={cx(classes.logo, collapsed && classes.logoCollapsed)}
            >
              {/* Default branding is the full quilt.bio wordmark: white text plus
                  the coral dot, which reads on the midnight rail. The rail slot is
                  wide, so the brand should read as a name rather than a dot;
                  collapsed it crossfades to the square Q mark. A customer's own
                  logo still renders via `src` as before. */}
              <div
                className={cx(
                  classes.logoStack,
                  collapsed &&
                    (settings?.logo?.url
                      ? classes.logoStackCustomCollapsed
                      : classes.logoStackCollapsed),
                )}
              >
                {settings?.logo?.url ? (
                  <Logo
                    height="32px"
                    width="100%"
                    src={settings.logo.url}
                    variant={collapsed ? 'icon' : 'wordmark'}
                  />
                ) : (
                  <>
                    <Logo
                      className={cx(classes.logoVariant, collapsed && classes.logoDim)}
                      height="32px"
                      width="100%"
                      variant="wordmark"
                    />
                    <Logo
                      className={cx(
                        classes.logoVariant,
                        classes.logoMark,
                        !collapsed && classes.logoDim,
                      )}
                      height="32px"
                      width="32px"
                      variant="icon"
                    />
                  </>
                )}
              </div>
            </Link>
            {canCollapse && (
              <CollapseToggle collapsed={collapsed} onToggle={toggleCollapsed} />
            )}
          </div>

          {(user || cfg.mode !== 'LOCAL') && (
            <>
              <Fold closed={collapsed}>
                <div className={classes.sectionLabel}>Workspace</div>
              </Fold>
              <div
                className={cx(classes.workspaceBox, collapsed && classes.boxCollapsed)}
              >
                <M.List disablePadding>
                  {user ? (
                    user.roles.length > 1 ? (
                      <RowTip
                        collapsed={collapsed}
                        title={`Workspace: ${user.role.name}`}
                      >
                        <M.ListItem
                          button
                          onClick={() => switchRole(user)}
                          className={cx(wsRowClass, classes.wsRowClickable)}
                        >
                          {workspaceContent}
                          <M.Icon className={cx(classes.trailing, labelClass)}>
                            expand_more
                          </M.Icon>
                        </M.ListItem>
                      </RowTip>
                    ) : (
                      <RowTip
                        collapsed={collapsed}
                        title={`Workspace: ${user.role.name}`}
                      >
                        <M.ListItem className={wsRowClass}>{workspaceContent}</M.ListItem>
                      </RowTip>
                    )
                  ) : (
                    <RowTip collapsed={collapsed} title="Sign in">
                      <M.ListItem
                        button
                        component={Link}
                        to={urls.signIn()}
                        className={cx(wsRowClass, classes.wsRowClickable)}
                      >
                        <M.ListItemIcon className={classes.icon}>
                          <OutlinedIcon>work_outline</OutlinedIcon>
                        </M.ListItemIcon>
                        <M.ListItemText primary="Sign in" className={labelClass} />
                      </M.ListItem>
                    </RowTip>
                  )}
                </M.List>
              </div>
            </>
          )}

          <M.List disablePadding className={classes.nav} id={NAV_ID}>
            <NavRow
              icon={<OutlinedIcon>storage</OutlinedIcon>}
              label="Volumes"
              to={urls.buckets()}
              selected={volumesActive}
              collapsed={collapsed}
            />
            <NavRow
              icon={<OutlinedIcon>search</OutlinedIcon>}
              label="Search"
              to={searchTo}
              selected={searchActive}
              collapsed={collapsed}
            />
            <NavRow
              icon={<OutlinedIcon>table_chart</OutlinedIcon>}
              label="Queries"
              to={urls.queries()}
              selected={queriesActive}
              collapsed={collapsed}
            />
            <NavRow
              icon={
                <M.Badge
                  variant="dot"
                  invisible={!bookmarks?.hasUpdates}
                  classes={{ dot: classes.badgeDot }}
                >
                  <OutlinedIcon>bookmarks</OutlinedIcon>
                </M.Badge>
              }
              label="Bookmarks"
              onClick={bookmarks?.show}
              disabled={!bookmarks}
              collapsed={collapsed}
            />
            {assistant && (
              <NavRow
                icon={<OutlinedIcon>assistant</OutlinedIcon>}
                label="Ask Qurator"
                onClick={assistant.show}
                collapsed={collapsed}
              />
            )}
            {user?.isAdmin && (
              <NavRow
                icon={<OutlinedIcon>security</OutlinedIcon>}
                label="Admin"
                to={urls.admin()}
                selected={adminActive}
                collapsed={collapsed}
              />
            )}
          </M.List>

          <div className={classes.spacer} />

          {subscription.invalid && (
            <M.List disablePadding className={classes.account}>
              <RowTip collapsed={collapsed} title="Unlicensed">
                <M.ListItem
                  className={cx(classes.unlicensedRow, collapsed && classes.rowCollapsed)}
                >
                  <M.ListItemIcon className={classes.icon}>
                    <OutlinedIcon color="error">warning</OutlinedIcon>
                  </M.ListItemIcon>
                  <M.ListItemText primary="Unlicensed" className={labelClass} />
                </M.ListItem>
              </RowTip>
            </M.List>
          )}
          {user && (
            <div className={cx(classes.identityBox, collapsed && classes.boxCollapsed)}>
              <AccountMenu
                name={user.name}
                signOutUrl={urls.signOut()}
                interactive={cfg.mode !== 'LOCAL'}
                collapsed={collapsed}
              />
            </div>
          )}
          <Version collapsed={collapsed} />
        </Rail>
      </NavShell>
      <Bookmarks.Drawer />
    </>
  )
}
