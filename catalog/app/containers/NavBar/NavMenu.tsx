// import cx from 'classnames'
import * as R from 'ramda'
import * as React from 'react'
import * as redux from 'react-redux'
import { Link, useRouteMatch } from 'react-router-dom'
import * as RR from 'react-router-dom'
import { createStructuredSelector } from 'reselect'
import { sanitizeUrl } from '@braintree/sanitize-url'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import * as Intercom from 'components/Intercom'
import cfg from 'constants/config'
import * as style from 'constants/style'
import * as URLS from 'constants/urls'
import * as Bookmarks from 'containers/Bookmarks'
import * as authSelectors from 'containers/Auth/selectors'
import * as CatalogSettings from 'utils/CatalogSettings'
import * as Dialogs from 'utils/GlobalDialogs'
import * as GQL from 'utils/GraphQL'
import * as NamedRoutes from 'utils/NamedRoutes'
import assertNever from 'utils/assertNever'
import * as tagged from 'utils/taggedV2'

import ME_QUERY from './gql/Me.generated'
import SWITCH_ROLE_MUTATION from './gql/SwitchRole.generated'

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

// XXX: don't use a separate type for this?
const NavItemDescriptor = tagged.create(
  'app/containers/NavBar/NavMenu:NavItemDescriptor' as const,
  {
    To: (to: string, children: React.ReactNode) => ({ to, children }),
    Href: (href: string, children: React.ReactNode) => ({ href, children }),
  },
)

// eslint-disable-next-line @typescript-eslint/no-redeclare
type NavItemDescriptor = tagged.InstanceOf<typeof NavItemDescriptor>

const MenuItemDescriptor = tagged.create(
  'app/containers/NavBar/NavMenu:MenuItemDescriptor' as const,
  {
    To: (to: string, children: React.ReactNode) => ({ to, children }),
    Href: (href: string, children: React.ReactNode) => ({ href, children }),
    Click: (onClick: () => void, children: React.ReactNode) => ({ onClick, children }),
    Text: (children: React.ReactNode) => ({ children }),
    Divider: () => {},
  },
)

// eslint-disable-next-line @typescript-eslint/no-redeclare
type MenuItemDescriptor = tagged.InstanceOf<typeof MenuItemDescriptor>

interface DropdownMenuProps
  extends Omit<
    M.MenuProps,
    'anchorEl' | 'open' | 'onClose' | 'children' | 'MenuListProps'
  > {
  trigger: (
    open: React.EventHandler<React.SyntheticEvent<HTMLElement>>,
  ) => React.ReactNode
  items: (MenuItemDescriptor | null | false)[]
}

function DropdownMenu({ trigger, items, ...rest }: DropdownMenuProps) {
  const [anchor, setAnchor] = React.useState<HTMLElement | null>(null)

  const open = React.useCallback(
    (evt: React.SyntheticEvent<HTMLElement>) => {
      setAnchor(evt.currentTarget)
    },
    [setAnchor],
  )

  const close = React.useCallback(() => {
    setAnchor(null)
  }, [setAnchor])

  const filtered = items.filter(Boolean) as MenuItemDescriptor[]
  const children = filtered.map(
    MenuItemDescriptor.match({
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
      Text: (props, i) => <M.MenuItem key={i} component="div" {...props} />,
      Divider: (_, i) => <M.Divider key={i} />,
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

const useRoleSwitcherStyles = M.makeStyles((t) => ({
  progress: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: t.spacing(4),
  },
}))

const useListItemTextStyles = M.makeStyles((t) => ({
  root: {
    padding: t.spacing(0, 1),
  },
  primary: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
}))

interface RoleSwitcherProps {
  user: Me
}

function RoleSwitcher({ user }: RoleSwitcherProps) {
  const switchRole = GQL.useMutation(SWITCH_ROLE_MUTATION)
  const classes = useRoleSwitcherStyles()
  const textClasses = useListItemTextStyles()
  const loading = true
  const [state, setState] = React.useState<Error | typeof loading | null>(null)
  const handleClick = React.useCallback(
    async (roleName: string) => {
      setState(loading)
      try {
        const { switchRole: r } = await switchRole({ roleName })
        switch (r.__typename) {
          case 'Me':
            window.location.reload()
            break
          case 'InvalidInput':
          case 'OperationError':
            throw new Error('Failed to switch role. Try again')
          default:
            assertNever(r)
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Error switching role', err)
        if (err instanceof Error) {
          setState(err)
        } else {
          setState(new Error('Unexpected error switching role'))
        }
      }
    },
    [loading, switchRole],
  )
  return (
    <>
      <M.DialogTitle>Switch role</M.DialogTitle>
      {state !== true ? (
        <>
          {state instanceof Error && (
            <Lab.Alert severity="error">{state.message}</Lab.Alert>
          )}
          <M.List>
            {user.roles.map((role) => (
              <M.ListItem
                button
                disabled={role.name === user.role.name}
                key={role.name}
                onClick={() => handleClick(role.name)}
                selected={role.name === user.role.name}
              >
                <M.ListItemText classes={textClasses}>{role.name}</M.ListItemText>
              </M.ListItem>
            ))}
          </M.List>
        </>
      ) : (
        <div className={classes.progress}>
          <M.CircularProgress size={48} />
        </div>
      )}
    </>
  )
}

const SWITCH_ROLES_DIALOG_PROPS = {
  maxWidth: 'sm' as const,
  fullWidth: true,
}

function useRoleSwitcher() {
  const openDialog = Dialogs.use()
  return (user: Me) =>
    openDialog(() => <RoleSwitcher user={user} />, SWITCH_ROLES_DIALOG_PROPS)
}

function useLinks(): NavItemDescriptor[] {
  const { urls } = NamedRoutes.use()
  const settings = CatalogSettings.use()

  const links: NavItemDescriptor[] = []
  const link = (l: NavItemDescriptor | false, cond = true) => cond && l && links.push(l)

  const customNavLink: NavItemDescriptor | false = React.useMemo(() => {
    if (!settings?.customNavLink) return false
    const href = sanitizeUrl(settings.customNavLink.url)
    if (href === 'about:blank') return false
    return NavItemDescriptor.Href(href, settings.customNavLink.label)
  }, [settings?.customNavLink])

  link(
    NavItemDescriptor.To(urls.example(), 'Example'),
    process.env.NODE_ENV === 'development',
  )
  link(customNavLink)
  link(NavItemDescriptor.To(urls.uriResolver(), 'URI'), cfg.mode !== 'MARKETING')
  link(NavItemDescriptor.Href(URLS.docs, 'Docs'))
  link(
    NavItemDescriptor.To(`${urls.home()}#pricing`, 'Pricing'),
    cfg.mode === 'MARKETING',
  )
  link(
    NavItemDescriptor.Href(URLS.jobs, 'Jobs'),
    cfg.mode === 'MARKETING' || cfg.mode === 'OPEN',
  )
  link(NavItemDescriptor.Href(URLS.blog, 'Blog'), cfg.mode !== 'PRODUCT')
  link(NavItemDescriptor.To(urls.about(), 'About'), cfg.mode === 'MARKETING')

  return links
}

const useUserDisplayStyles = M.makeStyles({
  role: {
    opacity: 0.5,
    fontWeight: 'lighter',
  },
})

interface UserDisplayProps {
  user: Me
}

function UserDisplay({ user }: UserDisplayProps) {
  const classes = useUserDisplayStyles()
  return withIcon(
    user.isAdmin ? 'security' : 'person',
    <>
      {user.name}
      <span className={classes.role}>&nbsp;({user.role.name})</span>
    </>,
  )
}

const useBadgeStyles = M.makeStyles({
  root: {
    alignItems: 'inherit',
  },
  badge: {
    top: '4px',
  },
})

interface BadgeProps extends M.BadgeProps {}

function Badge({ children, color, invisible, ...props }: BadgeProps) {
  const classes = useBadgeStyles()
  return (
    <M.Badge
      classes={classes}
      color={color}
      variant="dot"
      invisible={invisible}
      {...props}
    >
      {children}
    </M.Badge>
  )
}

const withIcon = (icon: string, children: React.ReactNode) => (
  <>
    <M.Icon fontSize="small">{icon}</M.Icon>&nbsp;{children}
  </>
)

interface DesktopUserDropdownProps {
  user: Me
}

function DesktopUserDropdown({ user }: DesktopUserDropdownProps) {
  const { urls } = NamedRoutes.use()
  const switchRole = useRoleSwitcher()
  const bookmarks = Bookmarks.use()
  // XXX: reset bookmarks updates state on close?
  const hasBookmarksUpdates = bookmarks?.hasUpdates ?? false

  const items = [
    cfg.mode === 'OPEN' &&
      MenuItemDescriptor.To(urls.profile(), withIcon('person', 'Profile')),
    user.roles.length > 1 &&
      MenuItemDescriptor.Click(() => switchRole(user), withIcon('loop', 'Switch role')),
    !!bookmarks &&
      MenuItemDescriptor.Click(
        () => bookmarks.show(),
        <>
          <Badge color="secondary" invisible={!hasBookmarksUpdates}>
            <M.Icon fontSize="small">bookmarks_outlined</M.Icon>
          </Badge>
          &nbsp;Bookmarks
        </>,
      ),
    user.isAdmin &&
      MenuItemDescriptor.To(urls.admin(), withIcon('security', 'Admin settings')),
    MenuItemDescriptor.To(urls.signOut(), withIcon('meeting_room', 'Sign Out')),
  ]

  return (
    <DropdownMenu
      trigger={(open) => (
        <M.Button
          variant="text"
          color="inherit"
          onClick={open}
          style={{ textTransform: 'none' }}
        >
          <Badge color="primary" invisible={!hasBookmarksUpdates}>
            <UserDisplay user={user} />
          </Badge>{' '}
          <M.Icon>expand_more</M.Icon>
        </M.Button>
      )}
      items={items}
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
  if (isSignIn || cfg.disableNavigator || cfg.mode === 'LOCAL') return null
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
  const links = useLinks()
  const switchRole = useRoleSwitcher()
  const bookmarks = Bookmarks.use()
  // XXX: reset bookmarks updates state on close?
  const hasBookmarksUpdates = bookmarks?.hasUpdates ?? false

  const authItems =
    cfg.disableNavigator || cfg.mode === 'LOCAL'
      ? []
      : [
          ...AuthState.match<(MenuItemDescriptor | false)[]>(
            {
              Loading: () => [MenuItemDescriptor.Text(withIcon('person', 'Loading...'))],
              Error: () => [
                MenuItemDescriptor.To(
                  urls.signIn(),
                  withIcon('error_outline', 'Sign In'),
                ),
              ],
              Ready: ({ user }) =>
                user
                  ? [
                      cfg.mode === 'OPEN'
                        ? MenuItemDescriptor.To(
                            urls.profile(),
                            <UserDisplay user={user} />,
                          )
                        : MenuItemDescriptor.Text(<UserDisplay user={user} />),
                      user.roles.length > 1 &&
                        MenuItemDescriptor.Click(
                          () => switchRole(user),
                          withIcon('loop', 'Switch role'),
                        ),
                      !!bookmarks &&
                        MenuItemDescriptor.Click(
                          () => bookmarks.show(),
                          <>
                            <Badge color="secondary" invisible={!hasBookmarksUpdates}>
                              <M.Icon fontSize="small">bookmarks_outlined</M.Icon>
                            </Badge>
                            &nbsp;Bookmarks
                          </>,
                        ),
                      user.isAdmin &&
                        MenuItemDescriptor.To(
                          urls.admin(),
                          withIcon('security', 'Admin settings'),
                        ),
                      MenuItemDescriptor.To(
                        urls.signOut(),
                        withIcon('meeting_room', 'Sign Out'),
                      ),
                    ]
                  : [
                      MenuItemDescriptor.To(
                        urls.signIn(),
                        withIcon('exit_to_app', 'Sign In'),
                      ),
                    ],
            },
            auth,
          ),
          MenuItemDescriptor.Divider(),
        ]

  const navItems = links.map(
    NavItemDescriptor.match<MenuItemDescriptor>({
      To: (props) => MenuItemDescriptor.To(props.to, props.children),
      Href: (props) => MenuItemDescriptor.Href(props.href, props.children),
    }),
  )

  const items = [...authItems, ...navItems]

  return (
    <DropdownMenu
      trigger={(open) => (
        <M.IconButton onClick={open} aria-label="Menu" edge="end">
          <M.Icon>menu</M.Icon>
        </M.IconButton>
      )}
      items={items}
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
  const links = useLinks()

  const mkTitle = (children: React.ReactNode) =>
    typeof children === 'string' && children.length > 10 ? children : undefined

  return (
    <nav className={classes.nav}>
      {links.map(
        NavItemDescriptor.match({
          To: (props, i) => (
            <RR.NavLink
              key={i}
              className={classes.link}
              activeClassName={classes.active}
              title={mkTitle(props.children)}
              {...props}
            />
          ),
          Href: (props, i) => (
            <a
              key={i}
              className={classes.link}
              target="_blank"
              title={mkTitle(props.children)}
              {...props}
            />
          ),
        }),
      )}
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
