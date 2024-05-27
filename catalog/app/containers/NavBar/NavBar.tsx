import invariant from 'invariant'
import * as R from 'ramda'
import * as React from 'react'
import * as redux from 'react-redux'
import { Link, useRouteMatch } from 'react-router-dom'
import { createStructuredSelector } from 'reselect'
import { sanitizeUrl } from '@braintree/sanitize-url'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import * as Intercom from 'components/Intercom'
import Logo from 'components/Logo'
import * as Bookmarks from 'containers/Bookmarks'
import cfg from 'constants/config'
import * as style from 'constants/style'
import * as URLS from 'constants/urls'
import * as authSelectors from 'containers/Auth/selectors'
import * as CatalogSettings from 'utils/CatalogSettings'
import * as Dialogs from 'utils/GlobalDialogs'
import * as GQL from 'utils/GraphQL'
import HashLink from 'utils/HashLink'
import * as NamedRoutes from 'utils/NamedRoutes'
import assertNever from 'utils/assertNever'

import bg from './bg.png'

import Controls from './Controls'
import * as Subscription from './Subscription'
import ME_QUERY from './gql/Me.generated'
import SWITCH_ROLE_MUTATION from './gql/SwitchRole.generated'

type MaybeMe = GQL.DataForDoc<typeof ME_QUERY>['me']
type Me = NonNullable<MaybeMe>

const SWITCH_ROLES_DIALOG_PROPS: Dialogs.ExtraDialogProps = {
  maxWidth: 'sm',
  fullWidth: true,
}

const useLogoLinkStyles = M.makeStyles((t) => ({
  bgQuilt: {
    background: `${t.palette.secondary.dark} left / 64px url(${bg})`,
  },
  bgCustom: {
    alignItems: 'center',
    // TODO: make UI component with this background, and DRY
    background: ({ backgroundColor }: { backgroundColor?: string }) =>
      backgroundColor || `${t.palette.secondary.dark} left / 64px url(${bg})`,
    borderRadius: t.spacing(0, 0, 2, 0),
    display: 'flex',
    justifyContent: 'center',
    minHeight: t.spacing(8),
    paddingRight: ({ backgroundColor }: { backgroundColor?: string }) =>
      backgroundColor ? t.spacing(4) : t.spacing(2),
  },
}))

function LogoLink() {
  const settings = CatalogSettings.use()
  const t = M.useTheme()
  const xs = M.useMediaQuery(t.breakpoints.down('xs'))
  const wide = cfg.mode === 'MARKETING' && xs
  const classes = useLogoLinkStyles({
    backgroundColor: settings?.theme?.palette?.primary?.main,
  })
  const { urls } = NamedRoutes.use()
  return (
    <div className={classes.bgQuilt}>
      <div className={classes.bgCustom}>
        <Link to={urls.home()}>
          <Logo
            width={wide ? '76.5px' : '27px'}
            height={wide ? '29px' : '27px'}
            src={settings?.logo?.url}
          />
        </Link>
      </div>
    </div>
  )
}

interface QuiltLinkProps {
  className?: string
}

function QuiltLink({ className }: QuiltLinkProps) {
  return (
    <a
      className={className}
      href={URLS.homeMarketing}
      target="_blank"
      title="Where data comes together"
    >
      <Logo width="27px" height="27px" />
    </a>
  )
}

const useItemStyles = M.makeStyles({
  root: {
    display: 'inline-flex',
    maxWidth: '400px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
})

// type ItemProps = (LinkProps | { href: string }) & M.MenuItemProps
interface ItemProps extends M.MenuItemProps {
  to?: string
  href?: string
}

// FIXME: doesn't compile with Ref<unknown>
// const Item = React.forwardRef((props: ItemProps, ref: React.Ref<unknown>) => (
const Item = React.forwardRef(
  ({ children, ...props }: ItemProps, ref: React.Ref<any>) => {
    const classes = useItemStyles()
    return (
      <M.MenuItem
        // @ts-expect-error
        // eslint-disable-next-line no-nested-ternary
        component={props.to ? Link : props.href ? 'a' : undefined}
        ref={ref}
        {...props}
      >
        <span className={classes.root}>{children}</span>
      </M.MenuItem>
    )
  },
)

const userDisplay = (user: Me) => (
  <>
    {user.isAdmin && (
      <>
        <M.Icon fontSize="small">security</M.Icon>
        &nbsp;
      </>
    )}
    {user.name}
  </>
)

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

const useRolesSwitcherStyles = M.makeStyles((t) => ({
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

interface RolesSwitcherProps {
  user: Me
}

function RolesSwitcher({ user }: RolesSwitcherProps) {
  const switchRole = GQL.useMutation(SWITCH_ROLE_MUTATION)
  const classes = useRolesSwitcherStyles()
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

interface UserDropdownProps {
  user: Me
}

function UserDropdown({ user }: UserDropdownProps) {
  const { urls, paths } = NamedRoutes.use()
  const bookmarks = Bookmarks.use()
  const isProfile = !!useRouteMatch({ path: paths.profile, exact: true })
  const isAdmin = !!useRouteMatch(paths.admin)
  const [anchor, setAnchor] = React.useState(null)
  const [visible, setVisible] = React.useState(true)

  const open = React.useCallback(
    (evt) => {
      setAnchor(evt.target)
    },
    [setAnchor],
  )

  const close = React.useCallback(() => {
    setVisible(false)
    setAnchor(null)
  }, [setAnchor])

  const openDialog = Dialogs.use()

  const showBookmarks = React.useCallback(() => {
    if (!bookmarks) return
    bookmarks.show()
    close()
  }, [bookmarks, close])

  const showRolesSwitcher = React.useCallback(() => {
    openDialog(() => <RolesSwitcher user={user} />, SWITCH_ROLES_DIALOG_PROPS)
    close()
  }, [openDialog, close, user])

  React.useEffect(() => {
    const hasUpdates = bookmarks?.hasUpdates || false
    if (hasUpdates !== visible) setVisible(!!hasUpdates)
  }, [bookmarks, visible])

  return (
    <>
      <M.Button variant="text" color="inherit" onClick={open}>
        <Badge color="primary" invisible={!visible}>
          {userDisplay(user)}
        </Badge>{' '}
        <M.Icon>expand_more</M.Icon>
      </M.Button>

      <M.MuiThemeProvider theme={style.appTheme}>
        <M.Menu anchorEl={anchor} open={!!anchor} onClose={close}>
          {bookmarks && (
            <Item onClick={showBookmarks}>
              <Badge color="secondary" invisible={!visible}>
                <M.Icon fontSize="small">bookmarks_outlined</M.Icon>
              </Badge>
              &nbsp;Bookmarks
            </Item>
          )}
          {user.roles.length > 1 && (
            <Item onClick={showRolesSwitcher}>
              <M.Icon fontSize="small">loop</M.Icon>&nbsp;Switch role
            </Item>
          )}
          {user.isAdmin && (
            <Item to={urls.admin()} onClick={close} selected={isAdmin} divider>
              <M.Icon fontSize="small">security</M.Icon>&nbsp;Admin settings
            </Item>
          )}
          {cfg.mode === 'OPEN' && (
            <Item to={urls.profile()} onClick={close} selected={isProfile}>
              Profile
            </Item>
          )}
          <Item to={urls.signOut()} onClick={close}>
            Sign Out
          </Item>
        </M.Menu>
      </M.MuiThemeProvider>
    </>
  )
}

function useHam() {
  const [anchor, setAnchor] = React.useState(null)

  const open = React.useCallback(
    (evt) => {
      setAnchor(evt.target)
    },
    [setAnchor],
  )

  const close = React.useCallback(() => {
    setAnchor(null)
  }, [setAnchor])

  const render = (children: React.ReactNode) => (
    <>
      <M.IconButton onClick={open} aria-label="Menu" edge="end">
        <M.Icon>menu</M.Icon>
      </M.IconButton>
      <M.MuiThemeProvider theme={style.appTheme}>
        <M.Menu
          anchorEl={anchor}
          open={!!anchor}
          onClose={close}
          MenuListProps={
            {
              component: 'nav',
              style: { minWidth: 120 },
            } as M.MenuListProps
          }
        >
          {children}
        </M.Menu>
      </M.MuiThemeProvider>
    </>
  )

  return { open, close, render }
}

function useAuthLinks(onHamClose: () => void): React.ReactNode[] {
  const { error, waiting, authenticated } = redux.useSelector(selector)
  const { urls, paths } = NamedRoutes.use()
  const isProfile = !!useRouteMatch({ path: paths.profile, exact: true })
  const isAdmin = !!useRouteMatch(paths.admin)

  const res = GQL.useQuery(ME_QUERY, undefined, { pause: waiting || !authenticated })

  if (error)
    return [
      <Item to={urls.signIn()} onClick={onHamClose} key="error">
        <M.Icon>error_outline</M.Icon> Sign In
      </Item>,
    ]
  if (waiting) {
    return [
      <Item onClick={onHamClose} key="progress">
        <M.CircularProgress />
      </Item>,
    ]
  }

  return GQL.fold(res, {
    data: (d) => {
      invariant(d.me, 'Expected "me" to be non-null')
      return [
        <M.MenuItem key="user" component="div">
          {userDisplay(d.me)}
        </M.MenuItem>,
        d.me.isAdmin && (
          <Item key="admin" to={urls.admin()} onClick={onHamClose} selected={isAdmin}>
            <M.Box component="span" pr={2} />
            <M.Icon fontSize="small">security</M.Icon>
            &nbsp;Admin settings
          </Item>
        ),
        cfg.mode === 'OPEN' && (
          <Item
            key="profile"
            to={urls.profile()}
            onClick={onHamClose}
            selected={isProfile}
          >
            <M.Box component="span" pr={2} />
            Profile
          </Item>
        ),
        <Item key="signout" to={urls.signOut()} onClick={onHamClose}>
          <M.Box component="span" pr={2} />
          Sign Out
        </Item>,
      ]
    },
    fetching: () => [
      <Item onClick={onHamClose} key="progress">
        <M.CircularProgress />
      </Item>,
    ],
    error: () => [
      <Item to={urls.signIn()} onClick={onHamClose} key="error">
        <M.Icon>error_outline</M.Icon> Sign In
      </Item>,
    ],
  })
}

const useSignInErrorStyles = M.makeStyles((t) => ({
  icon: {
    marginRight: t.spacing(1),
  },
}))

interface DesktopSignInErrorProps {
  error: Error | GQL.ErrorForData<typeof ME_QUERY>
}

function DesktopSignInError({ error }: DesktopSignInErrorProps) {
  const classes = useSignInErrorStyles()
  const { urls } = NamedRoutes.use()
  return (
    <>
      <M.Icon
        title={`${error.message}\n${JSON.stringify(error)}`}
        className={classes.icon}
      >
        error_outline
      </M.Icon>
      <M.Button component={Link} to={urls.signIn()} variant="contained" color="primary">
        Sign In
      </M.Button>
    </>
  )
}

function DesktopSignIn() {
  const { error, waiting, authenticated } = redux.useSelector(selector)
  const { paths } = NamedRoutes.use()
  const isSignIn = !!useRouteMatch({ path: paths.signIn, exact: true })
  const res = GQL.useQuery(ME_QUERY, undefined, { pause: waiting || !authenticated })

  if (!authenticated && isSignIn) return null

  if (error) {
    return <DesktopSignInError error={error} />
  }

  if (waiting) {
    return <M.CircularProgress color="inherit" />
  }

  return GQL.fold(res, {
    data: (d) => {
      invariant(d.me, 'Expected "me" to be non-null')
      return <UserDropdown user={d.me} />
    },
    fetching: () => <M.CircularProgress color="inherit" />,
    error: (err) => <DesktopSignInError error={err} />,
  })
}

interface MobileSignInProps {
  links: LinkDescriptor[]
}

function MobileSignIn({ links }: MobileSignInProps) {
  const ham = useHam()

  const mobileLinks = React.useMemo(
    () =>
      links.map(({ label, ...rest }) => (
        <Item key={`${label}:${rest.to || rest.href}`} {...rest} onClick={ham.close}>
          {label}
        </Item>
      )),
    [ham.close, links],
  )

  if (cfg.disableNavigator || cfg.mode === 'LOCAL') {
    return ham.render(mobileLinks)
  }

  return <MobileSignInWithAuth ham={ham} links={mobileLinks} />
}

interface MobileSignInInnerProps {
  ham: ReturnType<typeof useHam>
  links: React.ReactNode[]
}

// It's just a wrapper to put hook call, so we can hide it under condition
function MobileSignInWithAuth({ ham, links }: MobileSignInInnerProps) {
  const authLinks = useAuthLinks(ham.close)
  return ham.render([...authLinks, <M.Divider key="divider" />, ...links])
}

const useAppBarStyles = M.makeStyles((t) => ({
  root: {
    zIndex: t.zIndex.appBar + 1,
  },
  bgWrapper: {
    bottom: 0,
    display: 'flex',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  bgCustom: {
    background: ({ backgroundColor }: { backgroundColor?: string }) =>
      backgroundColor || `${t.palette.secondary.dark} left / 64px url(${bg})`,
    flex: '50%',
  },
  bgQuilt: {
    background: `${t.palette.secondary.dark} left / 64px url(${bg})`,
    flex: '50%',
  },
}))

interface AppBarProps {
  children: React.ReactNode
}

const AppBar = React.forwardRef<HTMLDivElement, AppBarProps>(function AppBar(
  { children },
  ref,
) {
  const settings = CatalogSettings.use()
  const classes = useAppBarStyles({
    backgroundColor: settings?.theme?.palette?.primary?.main,
  })
  return (
    <M.AppBar className={classes.root} ref={ref}>
      <div className={classes.bgWrapper}>
        <div className={classes.bgCustom} />
        <div className={classes.bgQuilt} />
      </div>
      {children}
    </M.AppBar>
  )
})

const useHeaderStyles = M.makeStyles((t) => ({
  container: {
    display: 'flex',
    alignItems: 'center',
  },
  main: {
    alignItems: 'center',
    background: `${t.palette.secondary.dark} left / 64px url(${bg})`,
    borderRadius: '16px 0 0 0',
    display: 'flex',
    flexGrow: 1,
    minHeight: '64px',
    paddingLeft: ({ customBg }: { customBg: boolean }) => (customBg ? '32px' : undefined),
  },
}))

interface HeaderProps {
  children?: React.ReactNode
}

export function Header({ children }: HeaderProps) {
  const trigger = M.useScrollTrigger()
  const settings = CatalogSettings.use()
  const classes = useHeaderStyles({
    customBg: !!settings?.theme?.palette?.primary?.main,
  })
  return (
    <M.Box>
      <M.Toolbar />
      <M.Slide appear={false} direction="down" in={!trigger}>
        <AppBar>
          <M.Toolbar disableGutters>
            <M.Container className={classes.container} maxWidth="lg">
              <LogoLink />
              <div className={classes.main}>{children}</div>
            </M.Container>
          </M.Toolbar>
        </AppBar>
      </M.Slide>
    </M.Box>
  )
}

interface ContainerProps {
  children?: React.ReactNode
}

export function Container({ children }: ContainerProps) {
  return (
    <M.MuiThemeProvider theme={style.navTheme}>
      <Header>{children}</Header>
    </M.MuiThemeProvider>
  )
}

interface NavLinkOwnProps {
  to?: string
  path?: string
}

type NavLinkProps = NavLinkOwnProps & M.BoxProps

const NavLink = React.forwardRef((props: NavLinkProps, ref: React.Ref<unknown>) => {
  const isActive = !!useRouteMatch({ path: props.path, exact: true })
  return (
    <M.Box
      component={props.to ? HashLink : 'a'}
      color={isActive ? 'text.disabled' : 'text.secondary'}
      fontSize="body2.fontSize"
      maxWidth={64}
      whiteSpace="nowrap"
      overflow="hidden"
      textOverflow="ellipsis"
      title={
        typeof props.children === 'string' && props.children.length > 10
          ? props.children
          : undefined
      }
      {...props}
      ref={ref}
    />
  )
})

interface LinkDescriptor {
  label: string
  to?: string
  href?: string
  target?: '_blank'
}

function useLinks(): LinkDescriptor[] {
  const { paths, urls } = NamedRoutes.use()
  const settings = CatalogSettings.use()
  const customNavLink: LinkDescriptor | null = React.useMemo(() => {
    if (!settings?.customNavLink) return null
    const href = sanitizeUrl(settings.customNavLink.url)
    if (href === 'about:blank') return null
    return {
      href,
      label: settings.customNavLink.label,
      target: '_blank',
    }
  }, [settings?.customNavLink])

  return [
    process.env.NODE_ENV === 'development' && {
      to: urls.example(),
      label: 'Example',
    },
    customNavLink,
    cfg.mode !== 'MARKETING' && {
      to: urls.uriResolver(),
      label: 'URI',
      path: paths.uriResolver,
    },
    { href: URLS.docs, label: 'Docs' },
    cfg.mode === 'MARKETING' && { to: `${urls.home()}#pricing`, label: 'Pricing' },
    (cfg.mode === 'MARKETING' || cfg.mode === 'OPEN') && {
      href: URLS.jobs,
      label: 'Jobs',
    },
    cfg.mode !== 'PRODUCT' && { href: URLS.blog, label: 'Blog' },
    cfg.mode === 'MARKETING' && { to: urls.about(), label: 'About' },
  ].filter(Boolean) as LinkDescriptor[]
}

const selector = createStructuredSelector(
  R.pick(['error', 'waiting', 'authenticated'], authSelectors),
)

const useNavBarStyles = M.makeStyles((t) => ({
  nav: {
    alignItems: 'center',
    display: 'flex',
    marginLeft: t.spacing(3),
    marginRight: t.spacing(2),
  },
  navItem: {
    '& + &': {
      marginLeft: t.spacing(2),
    },
  },
  quiltLogo: {
    margin: '0 0 3px 8px',
  },
  spacer: {
    flexGrow: 1,
  },
  licenseError: {
    color: t.palette.error.light,
    marginRight: t.spacing(0.5),

    [t.breakpoints.down('sm')]: {
      marginLeft: t.spacing(1.5),
      marginRight: 0,
    },
  },
}))

export function NavBar() {
  const settings = CatalogSettings.use()
  const { paths } = NamedRoutes.use()
  const isSignIn = !!useRouteMatch({ path: paths.signIn, exact: true })
  const t = M.useTheme()
  const useHamburger = M.useMediaQuery(t.breakpoints.down('sm'))
  const links = useLinks()
  const intercom = Intercom.use()
  const classes = useNavBarStyles()
  const sub = Subscription.useState()

  return (
    <Container>
      <Subscription.Display {...sub} />

      {cfg.disableNavigator || (cfg.alwaysRequiresAuth && isSignIn) ? (
        <div className={classes.spacer} />
      ) : (
        <Controls />
      )}

      {!useHamburger && (
        <nav className={classes.nav}>
          {links.map(({ label, ...rest }) => (
            <NavLink
              key={`${label}:${rest.to || rest.href}`}
              className={classes.navItem}
              {...rest}
            >
              {label}
            </NavLink>
          ))}
          {!intercom.dummy && intercom.isCustom && (
            <Intercom.Launcher className={classes.navItem} />
          )}
        </nav>
      )}

      {sub.invalid && (
        <M.Tooltip title="This Quilt stack is unlicensed. Contact your Quilt administrator.">
          <M.IconButton
            className={classes.licenseError}
            onClick={sub.restore}
            size="small"
          >
            <M.Icon>error_outline</M.Icon>
          </M.IconButton>
        </M.Tooltip>
      )}

      {!cfg.disableNavigator && cfg.mode !== 'LOCAL' && !useHamburger && (
        <DesktopSignIn />
      )}

      {useHamburger && <MobileSignIn links={links} />}

      {settings?.logo?.url && <QuiltLink className={classes.quiltLogo} />}
    </Container>
  )
}
