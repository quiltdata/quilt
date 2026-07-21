import * as React from 'react'
import { Link, useRouteMatch } from 'react-router-dom'
import * as M from '@material-ui/core'
import { fade } from '@material-ui/core/styles'

import * as Assistant from 'components/Assistant'
import Logo from 'components/Logo'
import cfg from 'constants/config'
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
  workspaceBox: {
    backgroundColor: fade(t.palette.common.white, 0.08),
    borderRadius: 4,
    margin: t.spacing(0, 1),
    overflow: 'hidden',
  },
  workspaces: {
    paddingBottom: t.spacing(0.5),
    paddingTop: t.spacing(1),
  },
  title: {
    fontWeight: 500,
  },
  icon: {
    color: 'inherit',
  },
  // Accepted via impeccable live (2026-07-21): inset rounded nav rows —
  // 8px side inset, 4px radius, 44px rows, 16px icon-label gap, flush items.
  nav: {
    padding: t.spacing(1.5, 1, 0),
  },
  // The active nav item needs to read louder than the always-selected workspace
  // chip (which keeps the default 0.16 fill): a stronger fill plus a heavier
  // label, applied only to these items.
  navItem: {
    borderRadius: 4,
    height: 44,
    padding: t.spacing(0, 1.5),
    '& $icon': {
      minWidth: 40,
    },
    '&:hover': {
      backgroundColor: fade(t.palette.common.white, 0.08),
    },
    '&.Mui-focusVisible': {
      outline: `2px solid ${fade(t.palette.common.white, 0.85)}`,
      outlineOffset: -2,
    },
    '&.Mui-selected': {
      backgroundColor: fade(t.palette.common.white, 0.24),
      '&:hover': {
        backgroundColor: fade(t.palette.common.white, 0.32),
      },
      '& .MuiListItemText-primary': {
        fontWeight: t.typography.fontWeightMedium,
      },
    },
  },
  spacer: {
    flexGrow: 1,
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
    opacity: 0.55,
    padding: t.spacing(0, 2, 1),
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

// impeccable live session: React must never reconcile inside the variants
// wrapper (live.js mutates that DOM) — render once, then freeze.
const Freeze = React.memo(
  ({ children }: { children: React.ReactNode }) => <>{children}</>,
  () => true,
)

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
      {/* impeccable live session: freeze the whole rail — live.js owns this DOM
          while variants are cycling; React must not place/reconcile inside. */}
      <Freeze>
        <Rail className={classes.root}>
          <Link to={urls.home()} className={classes.logo}>
            <Logo height="32px" width="100%" src={settings?.logo?.url} />
          </Link>
          <Version />

          <div className={classes.workspaceBox}>
            {/* impeccable-variants-start 7c641af7 */}
            <div
              data-impeccable-variants="7c641af7"
              data-impeccable-variant-count="3"
              style={{ display: 'contents' }}
            >
              <style data-impeccable-css="7c641af7">{`
                @scope ([data-impeccable-variant="1"]) {
                  :scope > ul { list-style: none; margin: 0; padding: 4px 0 6px; color: #fff; font-family: Roboto, Helvetica, Arial, sans-serif; }
                  :scope .hd { padding: 8px 12px 2px; font-size: 11px; font-weight: 500; letter-spacing: 0.06em; text-transform: uppercase; color: rgba(255,255,255,0.6); }
                  :scope .row { display: flex; align-items: center; gap: calc(var(--p-gap, 16) * 1px); width: 100%; box-sizing: border-box; padding: 6px 12px; background: none; border: 0; color: #fff; cursor: pointer; text-align: left; font: inherit; }
                  :scope[data-p-density="compact"] .row { padding: 3px 12px; }
                  :scope .row:hover { background: rgba(255,255,255,0.08); }
                  :scope .row:focus-visible { outline: 2px solid rgba(255,255,255,0.85); outline-offset: -2px; }
                  :scope .ic { font-size: 24px; width: 24px; }
                  :scope .tx { display: flex; flex-direction: column; min-width: 0; }
                  :scope .t1 { font-size: 14px; font-weight: 500; line-height: 1.4; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                  :scope .t2 { font-size: 12px; line-height: 1.35; color: rgba(255,255,255,0.6); }
                  :scope .chev { margin-left: auto; font-size: 20px; color: rgba(255,255,255,0.55); display: none; }
                  :scope .row:hover .chev { color: rgba(255,255,255,0.9); }
                  :scope:not([data-p-chevron="expand"]):not([data-p-chevron="swap"]) .chev-unfold { display: inline-block; }
                  :scope[data-p-chevron="expand"] .chev-expand { display: inline-block; }
                  :scope[data-p-chevron="swap"] .chev-swap { display: inline-block; }
                }
                @scope ([data-impeccable-variant="2"]) {
                  :scope > ul { list-style: none; margin: 0; padding: 8px 0; color: #fff; font-family: Roboto, Helvetica, Arial, sans-serif; }
                  :scope .row { display: flex; align-items: center; gap: calc(var(--p-gap, 16) * 1px); width: 100%; box-sizing: border-box; padding: 6px 12px; background: none; border: 0; color: #fff; cursor: pointer; text-align: left; font: inherit; }
                  :scope[data-p-density="compact"] .row { padding: 3px 12px; }
                  :scope .row:hover { background: rgba(255,255,255,0.08); }
                  :scope .row:focus-visible { outline: 2px solid rgba(255,255,255,0.85); outline-offset: -2px; }
                  :scope .avatar { width: 28px; height: 28px; border-radius: 50%; background: rgba(255,255,255,0.18); display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 500; flex: none; }
                  :scope .ic { font-size: 24px; width: 24px; }
                  :scope .tx { display: flex; flex-direction: column; min-width: 0; flex: 1; }
                  :scope .t1 { font-size: 14px; font-weight: 500; line-height: 1.4; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                  :scope .t2 { font-size: 12px; line-height: 1.35; color: rgba(255,255,255,0.6); }
                  :scope .chev { margin-left: auto; font-size: 20px; color: rgba(255,255,255,0.55); }
                  :scope .row:hover .chev { color: rgba(255,255,255,0.9); }
                  :scope .so { margin-left: auto; background: none; border: 0; color: rgba(255,255,255,0.55); cursor: pointer; padding: 4px; font-size: 18px; border-radius: 4px; }
                  :scope .so:hover { color: #fff; background: rgba(255,255,255,0.12); }
                  :scope .dv { height: 1px; background: rgba(255,255,255,0.12); margin: 4px 12px; }
                  :scope[data-p-divider="0"] .dv, :scope:not([data-p-divider]) .dv-off { display: none; }
                }
                @scope ([data-impeccable-variant="3"]) {
                  :scope > ul { list-style: none; margin: 0; padding: 4px 0; color: #fff; font-family: Roboto, Helvetica, Arial, sans-serif; }
                  :scope .row { display: flex; align-items: center; gap: calc(var(--p-gap, 16) * 1px); width: 100%; box-sizing: border-box; padding: 8px 12px; background: none; border: 0; color: #fff; cursor: pointer; text-align: left; font: inherit; }
                  :scope[data-p-density="compact"] .row { padding: 5px 12px; }
                  :scope .row:hover { background: rgba(255,255,255,0.08); }
                  :scope .row:focus-visible { outline: 2px solid rgba(255,255,255,0.85); outline-offset: -2px; }
                  :scope .ic { font-size: 24px; width: 24px; }
                  :scope .tx { display: flex; flex-direction: column; min-width: 0; }
                  :scope .ov { display: none; font-size: 10px; font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase; color: rgba(255,255,255,0.55); line-height: 1.3; }
                  :scope[data-p-label="1"] .ov { display: block; }
                  :scope .t1 { font-size: 14px; font-weight: 500; line-height: 1.4; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                  :scope .t2 { font-size: 11px; line-height: 1.35; color: rgba(255,255,255,0.6); }
                  :scope .chev { margin-left: auto; font-size: 20px; color: rgba(255,255,255,0.55); }
                  :scope .row:hover .chev { color: rgba(255,255,255,0.9); }
                }
              `}</style>
              <div
                data-impeccable-variant="1"
                data-impeccable-params='[{"id":"gap","kind":"range","min":8,"max":24,"step":1,"default":16,"label":"Icon-label gap"},{"id":"density","kind":"steps","default":"regular","label":"Density","options":[{"value":"compact","label":"Compact"},{"value":"regular","label":"Regular"}]},{"id":"chevron","kind":"steps","default":"unfold","label":"Switch cue","options":[{"value":"unfold","label":"Unfold"},{"value":"expand","label":"Expand"},{"value":"swap","label":"Swap"}]}]'
              >
                <ul>
                  <li className="hd">Workspace</li>
                  <li>
                    <button className="row" type="button">
                      <span className="ic material-icons material-icons-outlined" aria-hidden="true">work_outline</span>
                      <span className="tx"><span className="t1">ReadWriteQuiltBucket</span><span className="t2">4 workspaces available</span></span>
                      <span className="chev chev-unfold material-icons" aria-hidden="true">unfold_more</span>
                      <span className="chev chev-expand material-icons" aria-hidden="true">expand_more</span>
                      <span className="chev chev-swap material-icons material-icons-outlined" aria-hidden="true">swap_horiz</span>
                    </button>
                  </li>
                </ul>
              </div>
              <div
                data-impeccable-variant="2"
                style={{ display: 'none' }}
                data-impeccable-params='[{"id":"divider","kind":"toggle","default":true,"label":"Divider"},{"id":"gap","kind":"range","min":8,"max":24,"step":1,"default":16,"label":"Icon-label gap"},{"id":"density","kind":"steps","default":"regular","label":"Density","options":[{"value":"compact","label":"Compact"},{"value":"regular","label":"Regular"}]}]'
              >
                <ul>
                  <li>
                    <div className="row" style={{ cursor: 'default' }}>
                      <span className="avatar">NL</span>
                      <span className="tx"><span className="t1">nl_0</span></span>
                      <button className="so material-icons material-icons-outlined" type="button" title="Sign out" aria-label="Sign out">meeting_room</button>
                    </div>
                  </li>
                  <li className="dv" role="presentation"></li>
                  <li>
                    <button className="row" type="button">
                      <span className="ic material-icons material-icons-outlined" aria-hidden="true">work_outline</span>
                      <span className="tx"><span className="t1">ReadWriteQuiltBucket</span><span className="t2">4 available</span></span>
                      <span className="chev material-icons" aria-hidden="true">unfold_more</span>
                    </button>
                  </li>
                </ul>
              </div>
              <div
                data-impeccable-variant="3"
                style={{ display: 'none' }}
                data-impeccable-params='[{"id":"label","kind":"toggle","default":false,"label":"Workspace overline"},{"id":"gap","kind":"range","min":8,"max":24,"step":1,"default":16,"label":"Icon-label gap"},{"id":"density","kind":"steps","default":"regular","label":"Density","options":[{"value":"compact","label":"Compact"},{"value":"regular","label":"Regular"}]}]'
              >
                <ul>
                  <li>
                    <button className="row" type="button">
                      <span className="ic material-icons material-icons-outlined" aria-hidden="true">work_outline</span>
                      <span className="tx"><span className="ov">Workspace</span><span className="t1">ReadWriteQuiltBucket</span><span className="t2">Workspace · 4 available</span></span>
                      <span className="chev material-icons" aria-hidden="true">unfold_more</span>
                    </button>
                  </li>
                </ul>
              </div>
              <div data-impeccable-variant="original" style={{ display: 'none' }}>
            <M.List disablePadding className={classes.workspaces}>
              <M.ListSubheader disableSticky className={classes.title}>
                Workspace
              </M.ListSubheader>
              {user ? (
                user.roles.length > 1 ? (
                  <M.ListItem button onClick={() => switchRole(user)}>
                    {workspace}
                  </M.ListItem>
                ) : (
                  <M.ListItem>{workspace}</M.ListItem>
                )
              ) : (
                <M.ListItem button component={Link} to={urls.signIn()}>
                  <M.ListItemIcon className={classes.icon}>
                    <OutlinedIcon>work_outline</OutlinedIcon>
                  </M.ListItemIcon>
                  <M.ListItemText primary="Sign in" secondary="to select a workspace" />
                </M.ListItem>
              )}
            </M.List>
              </div>
            </div>
            {/* impeccable-variants-end 7c641af7 */}
          </div>

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
              <M.ListItemText primary="Volumes" />
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
              <M.ListItemText primary="Search" />
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
              <M.ListItemText primary="Queries" />
            </M.ListItem>
            <M.ListItem
              button
              onClick={bookmarks?.show}
              disabled={!bookmarks}
              className={classes.navItem}
            >
              <M.ListItemIcon className={classes.icon}>
                <M.Badge color="primary" variant="dot" invisible={!bookmarks?.hasUpdates}>
                  <OutlinedIcon>bookmarks</OutlinedIcon>
                </M.Badge>
              </M.ListItemIcon>
              <M.ListItemText primary="Bookmarks" />
            </M.ListItem>
            {assistant && (
              <M.ListItem button onClick={assistant.show} className={classes.navItem}>
                <M.ListItemIcon className={classes.icon}>
                  <OutlinedIcon>assistant</OutlinedIcon>
                </M.ListItemIcon>
                <M.ListItemText primary="Ask Qurator" />
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
                <M.ListItemText primary="Admin" />
              </M.ListItem>
            )}
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
        </Rail>
      </Freeze>
      <Bookmarks.Drawer />
    </>
  )
}
