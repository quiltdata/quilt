import * as R from 'ramda'
import * as React from 'react'
import * as redux from 'react-redux'
import { Link, useRouteMatch } from 'react-router-dom'
import * as RR from 'react-router-dom'
import { createStructuredSelector } from 'reselect'
import { sanitizeUrl } from '@braintree/sanitize-url'
import * as M from '@material-ui/core'

import * as Intercom from 'components/Intercom'
import cfg from 'constants/config'
import * as style from 'constants/style'
import * as URLS from 'constants/urls'
import * as Bookmarks from 'containers/Bookmarks'
import * as authSelectors from 'containers/Auth/selectors'
import * as CatalogSettings from 'utils/CatalogSettings'
import * as GQL from 'utils/GraphQL'
import * as NamedRoutes from 'utils/NamedRoutes'
import * as tagged from 'utils/taggedV2'

import useRoleSwitcher from './RoleSwitcher'

import ME_QUERY from './gql/Me.generated'

type MaybeMe = GQL.DataForDoc<typeof ME_QUERY>['me']
type Me = NonNullable<MaybeMe>

const AuthState = tagged.create('app/containers/NavBar/NavMenu:AuthState' as const, {
  Loading: () => {},
  Error: (error: Error) => ({ error }),
  Ready: (user: MaybeMe) => ({ user }),
})

// eslint-disable-next-line @typescript-eslint/no-redeclare
type AuthState = tagged.InstanceOf<typeof AuthState>

const authSelector = createStructuredSelector(
  R.pick(['error', 'waiting', 'authenticated'], authSelectors),
)

function useAuthState(): AuthState {
  const { error, waiting, authenticated } = redux.useSelector(authSelector)
  const meQuery = GQL.useQuery(ME_QUERY, {}, { pause: waiting || !authenticated })
  if (error) return AuthState.Error(error)
  if (waiting) return AuthState.Loading()
  if (!authenticated) return AuthState.Ready(null)
  return GQL.fold(meQuery, {
    data: (d) =>
      d.me
        ? AuthState.Ready(d.me)
        : AuthState.Error(new Error("Couldn't load user data")),
    fetching: () => AuthState.Loading(),
    error: (err) => AuthState.Error(err),
  })
}

const ItemDescriptor = tagged.create(
  'app/containers/NavBar/NavMenu:ItemDescriptor' as const,
  {
    To: (to: string, children: React.ReactNode) => ({ to, children }),
    Href: (href: string, children: React.ReactNode) => ({ href, children }),
    Click: (onClick: () => void, children: React.ReactNode) => ({ onClick, children }),
    Text: (children: React.ReactNode) => ({ children }),
    Divider: () => {},
  },
)

// eslint-disable-next-line @typescript-eslint/no-redeclare
type ItemDescriptor = tagged.InstanceOf<typeof ItemDescriptor>

const useDropdownMenuStyles = M.makeStyles((t) => ({
  divider: {
    marginBottom: t.spacing(1),
    marginTop: t.spacing(1),
  },
}))

interface DropdownMenuProps
  extends Omit<
    M.MenuProps,
    'anchorEl' | 'open' | 'onClose' | 'children' | 'MenuListProps'
  > {
  trigger: (
    open: React.EventHandler<React.SyntheticEvent<HTMLElement>>,
  ) => React.ReactNode
  onClose?: () => void
  items: (ItemDescriptor | false)[]
}

function DropdownMenu({ trigger, items, onClose, ...rest }: DropdownMenuProps) {
  const classes = useDropdownMenuStyles()

  const [anchor, setAnchor] = React.useState<HTMLElement | null>(null)

  const open = React.useCallback(
    (evt: React.SyntheticEvent<HTMLElement>) => {
      setAnchor(evt.currentTarget)
    },
    [setAnchor],
  )

  const close = React.useCallback(() => {
    setAnchor(null)
    if (onClose) onClose()
  }, [setAnchor, onClose])

  const filtered = items.filter(Boolean) as ItemDescriptor[]
  const children = filtered.map(
    ItemDescriptor.match({
      To: (props, i) => (
        <RR.Route key={i} path={props.to}>
          {({ match }) => (
            <M.MenuItem
              key={i}
              component={Link}
              onClick={close}
              selected={!!match}
              {...props}
            />
          )}
        </RR.Route>
      ),
      Href: (props, i) => (
        <M.MenuItem key={i} component="a" onClick={close} target="_blank" {...props} />
      ),
      Click: ({ onClick, ...props }, i) => (
        <M.MenuItem
          key={i}
          component="div"
          onClick={() => {
            onClick()
            close()
          }}
          {...props}
        />
      ),
      Text: (props, i) => (
        <M.MenuItem key={i} component="div" disabled style={{ opacity: 1 }} {...props} />
      ),
      Divider: (_, i) => <M.Divider key={i} className={classes.divider} />,
    }),
  )

  return (
    <>
      {trigger(open)}
      <M.MuiThemeProvider theme={style.appTheme}>
        <M.Menu
          anchorEl={anchor}
          open={!!anchor}
          onClose={close}
          MenuListProps={{ component: 'nav' } as M.MenuListProps}
          {...rest}
        >
          {children}
        </M.Menu>
      </M.MuiThemeProvider>
    </>
  )
}

const useItemStyles = M.makeStyles((t) => ({
  icon: {
    minWidth: '36px',
  },
  text: {
    paddingRight: '8px',
  },
  secondary: {
    fontSize: t.typography.body2.fontSize,
    fontWeight: 'lighter',
    opacity: 0.6,

    '&::before': {
      content: '" – "',
    },
  },
}))

interface ItemContentsProps {
  icon?: React.ReactNode
  primary: React.ReactNode
  secondary?: React.ReactNode
}

function ItemContents({ icon, primary, secondary }: ItemContentsProps) {
  const classes = useItemStyles()
  const iconEl = typeof icon === 'string' ? <M.Icon>{icon}</M.Icon> : icon
  return (
    <>
      {!!iconEl && <M.ListItemIcon className={classes.icon}>{iconEl}</M.ListItemIcon>}
      <M.ListItemText
        primary={
          <>
            {primary}
            {!!secondary && <span className={classes.secondary}>{secondary}</span>}
          </>
        }
        className={classes.text}
      />
    </>
  )
}

function useGetAuthItems() {
  const { urls } = NamedRoutes.use()
  const switchRole = useRoleSwitcher()
  const bookmarks = Bookmarks.use()

  return function getAuthLinks(user: Me) {
    const items: ItemDescriptor[] = []

    const userItem = (
      <ItemContents
        icon="account_circle"
        primary={user.name}
        secondary={user.role.name}
      />
    )
    items.push(
      cfg.mode === 'OPEN' // currently only OPEN has profile page
        ? ItemDescriptor.To(urls.profile(), userItem)
        : ItemDescriptor.Text(userItem),
    )

    if (user.roles.length > 1) {
      items.push(
        ItemDescriptor.Click(
          () => switchRole(user),
          <ItemContents
            icon="people_outline"
            primary="Switch role"
            secondary={<>{user.roles.length} available</>}
          />,
        ),
      )
    }

    items.push(ItemDescriptor.Divider())

    if (bookmarks) {
      items.push(
        ItemDescriptor.Click(
          bookmarks.show,
          <ItemContents
            icon={
              <M.Badge invisible={!bookmarks?.hasUpdates} color="secondary" variant="dot">
                <M.Icon>bookmarks_outline</M.Icon>
              </M.Badge>
            }
            primary="Bookmarks"
          />,
        ),
      )
    }

    if (user.isAdmin) {
      items.push(
        ItemDescriptor.To(urls.admin(), <ItemContents icon="security" primary="Admin" />),
      )
    }

    items.push(
      ItemDescriptor.To(
        urls.signOut(),
        <ItemContents icon="meeting_room" primary="Sign Out" />,
      ),
    )

    return items
  }
}

interface DesktopUserDropdownProps {
  user: Me
}

function DesktopUserDropdown({ user }: DesktopUserDropdownProps) {
  const bookmarks = Bookmarks.use()
  const getAuthItems = useGetAuthItems()

  return (
    <DropdownMenu
      trigger={(open) => (
        <M.Button
          variant="text"
          color="inherit"
          onClick={open}
          style={{ textTransform: 'none' }}
        >
          <M.Badge
            invisible={!bookmarks?.hasUpdates}
            color="primary"
            variant="dot"
            overlap="circle"
          >
            <M.Icon fontSize="small">account_circle</M.Icon>
          </M.Badge>
          &nbsp;&nbsp;
          {user.name}
          &nbsp;
          <M.Icon fontSize="small">expand_more</M.Icon>
        </M.Button>
      )}
      items={getAuthItems(user)}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      transformOrigin={{ vertical: 'top', horizontal: 'right' }}
    />
  )
}

const useDesktopSignInStyles = M.makeStyles((t) => ({
  icon: {
    marginRight: t.spacing(1),
  },
}))

interface DesktopSignInProps {
  error?: Error
}

function DesktopSignIn({ error }: DesktopSignInProps) {
  const classes = useDesktopSignInStyles()
  const { urls } = NamedRoutes.use()
  return (
    <>
      {!!error && (
        <M.Tooltip title={`${error.message}\n${JSON.stringify(error)}`}>
          <M.Icon className={classes.icon}>error_outline</M.Icon>
        </M.Tooltip>
      )}
      <M.Button component={Link} to={urls.signIn()} variant="contained" color="primary">
        Sign In
      </M.Button>
    </>
  )
}

const useLinksStyles = M.makeStyles((t) => ({
  icon: {
    justifyContent: 'center',
  },
  item: {
    minWidth: t.spacing(30),
    paddingRight: t.spacing(1),
  },
}))

export function Links() {
  const classes = useLinksStyles()
  const intercom = Intercom.use()
  const { urls } = NamedRoutes.use()

  const settings = CatalogSettings.use()

  const customHref: { href: string; label: string } | null = React.useMemo(() => {
    if (!settings?.customNavLink) return null
    const href = sanitizeUrl(settings.customNavLink.url)
    if (href === 'about:blank') return null
    return { href, label: settings.customNavLink.label }
  }, [settings?.customNavLink])

  const [anchorEl, setAnchorEl] = React.useState<HTMLElement | null>(null)

  return (
    <>
      <M.IconButton
        onClick={(event) => setAnchorEl(event.currentTarget)}
        edge="start"
        color="inherit"
      >
        <M.Icon fontSize="inherit">menu</M.Icon>
      </M.IconButton>
      <M.MuiThemeProvider theme={style.appTheme}>
        <M.Menu
          className={classes.item}
          anchorEl={anchorEl}
          open={!!anchorEl}
          onClose={() => setAnchorEl(null)}
          keepMounted
        >
          {customHref}

          <M.MenuItem
            className={classes.item}
            component={RR.NavLink}
            disableGutters
            to={urls.uriResolver()}
          >
            <M.ListItemIcon className={classes.icon}>
              <M.Icon>public</M.Icon>
            </M.ListItemIcon>
            <M.ListItemText primary="Uri" />
          </M.MenuItem>

          <M.MenuItem
            className={classes.item}
            component="a"
            disableGutters
            href={URLS.docs}
            target="_blank"
          >
            <M.ListItemIcon className={classes.icon}>
              <M.Icon>menu_book</M.Icon>
            </M.ListItemIcon>
            <M.ListItemText primary="Docs" />
          </M.MenuItem>

          {cfg.mode === 'OPEN' && (
            <M.MenuItem
              className={classes.item}
              component="a"
              disableGutters
              href={URLS.jobs}
              target="_blank"
            >
              <M.ListItemIcon className={classes.icon}>
                <M.Icon>work</M.Icon>
              </M.ListItemIcon>
              <M.ListItemText primary="Jobs" />
            </M.MenuItem>
          )}

          {cfg.mode === 'OPEN' && (
            <M.MenuItem
              className={classes.item}
              component="a"
              disableGutters
              href={URLS.blog}
              target="_blank"
            >
              <M.ListItemIcon className={classes.icon}>
                <M.Icon>chat</M.Icon>
              </M.ListItemIcon>
              <M.ListItemText primary="Blog" />
            </M.MenuItem>
          )}

          {!intercom.dummy && intercom.isCustom && (
            <M.MenuItem
              className={classes.item}
              disableGutters
              id={Intercom.DOM_ID}
              onClick={() => setAnchorEl(null)}
            >
              <M.ListItemIcon className={classes.icon}>
                <M.Icon>chat_bubble_outline</M.Icon>
              </M.ListItemIcon>
              <M.ListItemText primary="Support" />
            </M.MenuItem>
          )}
        </M.Menu>
      </M.MuiThemeProvider>
    </>
  )
}

export function Menu() {
  const auth = useAuthState()
  const { paths } = NamedRoutes.use()
  const isSignIn = !!useRouteMatch({ path: paths.signIn, exact: true })
  if (isSignIn || cfg.mode === 'LOCAL') return null
  return AuthState.match(
    {
      Ready: ({ user }) =>
        user ? <DesktopUserDropdown user={user} /> : <DesktopSignIn />,
      Error: ({ error }) => <DesktopSignIn error={error} />,
      Loading: () => <M.CircularProgress color="inherit" size={20} />,
    },
    auth,
  )
}
