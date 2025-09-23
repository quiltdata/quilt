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
import assertNever from 'utils/assertNever'
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

const mkNavItem = (
  kind: 'to' | 'href',
  target: string,
  label: string,
  icon: string = 'open_in_new',
) => ({ kind, target, label, icon })

type NavItem = ReturnType<typeof mkNavItem>

function useNavItems(): NavItem[] {
  const { urls } = NamedRoutes.use()
  const settings = CatalogSettings.use()

  const customNavLink: NavItem | false = React.useMemo(() => {
    if (!settings?.customNavLink) return false
    const href = sanitizeUrl(settings.customNavLink.url)
    if (href === 'about:blank') return false
    return mkNavItem('href', href, settings.customNavLink.label)
  }, [settings?.customNavLink])

  return [
    customNavLink,
    mkNavItem('to', urls.agent(), 'Agent', 'assistant'),
    mkNavItem('to', urls.uriResolver(), 'URI', 'public'),
    mkNavItem('href', URLS.docs, 'Docs', 'menu_book'),
    cfg.mode === 'OPEN' && mkNavItem('href', URLS.jobs, 'Jobs', 'work'),
    cfg.mode === 'OPEN' && mkNavItem('href', URLS.blog, 'Blog', 'chat'),
  ].filter(Boolean) as NavItem[]
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

const useDesktopProgressStyles = M.makeStyles((t) => ({
  progress: {
    marginLeft: t.spacing(1),
  },
}))

function DesktopProgress() {
  const classes = useDesktopProgressStyles()
  return <M.CircularProgress color="inherit" size={20} className={classes.progress} />
}

interface DesktopMenuProps {
  auth: AuthState
}

function DesktopMenu({ auth }: DesktopMenuProps) {
  const { paths } = NamedRoutes.use()
  const isSignIn = !!useRouteMatch({ path: paths.signIn, exact: true })
  if (isSignIn || cfg.mode === 'LOCAL') return null
  return AuthState.match(
    {
      Ready: ({ user }) =>
        user ? <DesktopUserDropdown user={user} /> : <DesktopSignIn />,
      Error: ({ error }) => <DesktopSignIn error={error} />,
      Loading: () => <DesktopProgress />,
    },
    auth,
  )
}

interface MobileMenuProps {
  auth: AuthState
}

function MobileMenu({ auth }: MobileMenuProps) {
  const { urls } = NamedRoutes.use()
  const navItems = useNavItems()
  const getAuthItems = useGetAuthItems()
  const bookmarks = Bookmarks.use()

  const authItems = React.useMemo(() => {
    if (cfg.mode === 'LOCAL') return []
    return AuthState.match<(ItemDescriptor | false)[]>(
      {
        Loading: () => [
          ItemDescriptor.Text(
            <ItemContents icon={<M.CircularProgress size={20} />} primary="Loading..." />,
          ),
        ],
        Error: () => [
          ItemDescriptor.To(
            urls.signIn(),
            <ItemContents icon="error_outline" primary="Sign In" />,
          ),
        ],
        Ready: ({ user }) =>
          user
            ? getAuthItems(user)
            : [
                ItemDescriptor.To(
                  urls.signIn(),
                  <ItemContents icon="exit_to_app" primary="Sign In" />,
                ),
              ],
      },
      auth,
    ).concat(ItemDescriptor.Divider())
  }, [auth, getAuthItems, urls])

  const links = React.useMemo(
    () =>
      navItems.map((n) => {
        const children = <ItemContents icon={n.icon} primary={n.label} />
        switch (n.kind) {
          case 'to':
            return ItemDescriptor.To(n.target, children)
          case 'href':
            return ItemDescriptor.Href(n.target, children)
          default:
            assertNever(n.kind)
        }
      }),
    [navItems],
  )

  return (
    <DropdownMenu
      trigger={(open) => (
        <M.IconButton onClick={open} aria-label="Menu" edge="end">
          <M.Badge
            invisible={!bookmarks?.hasUpdates}
            color="primary"
            variant="dot"
            overlap="circle"
          >
            <M.Icon>menu</M.Icon>
          </M.Badge>
        </M.IconButton>
      )}
      items={[...authItems, ...links]}
    />
  )
}

const useNavStyles = M.makeStyles((t) => ({
  nav: {
    alignItems: 'center',
    display: 'flex',
    marginLeft: t.spacing(3),
    marginRight: t.spacing(2),
  },
  active: {},
  link: {
    color: t.palette.text.secondary,
    fontSize: t.typography.body2.fontSize,
    maxWidth: '64px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',

    '& + &': {
      marginLeft: t.spacing(2),
    },

    '&$active': {
      color: t.palette.text.disabled,
    },
  },
  intercom: {
    marginLeft: t.spacing(2),
  },
}))

export function Links() {
  const classes = useNavStyles()
  const intercom = Intercom.use()
  const navItems = useNavItems()

  const mkTitle = (label: string) => (label.length > 10 ? label : undefined)

  const links = navItems.map((n, i) => {
    switch (n.kind) {
      case 'to':
        return (
          <RR.NavLink
            key={i}
            className={classes.link}
            activeClassName={classes.active}
            title={mkTitle(n.label)}
            to={n.target}
          >
            {n.label}
          </RR.NavLink>
        )
      case 'href':
        return (
          <a
            key={i}
            className={classes.link}
            target="_blank"
            title={mkTitle(n.label)}
            href={n.target}
          >
            {n.label}
          </a>
        )
      default:
        assertNever(n.kind)
    }
  })

  return (
    <nav className={classes.nav}>
      {links}
      {!intercom.dummy && intercom.isCustom && (
        <Intercom.Launcher className={classes.intercom} />
      )}
    </nav>
  )
}

interface MenuProps {
  collapse: boolean
}

export function Menu({ collapse }: MenuProps) {
  const auth = useAuthState()
  return collapse ? <MobileMenu auth={auth} /> : <DesktopMenu auth={auth} />
}
