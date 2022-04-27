import cx from 'classnames'
import * as R from 'ramda'
import * as React from 'react'
import * as redux from 'react-redux'
import { Link } from 'react-router-dom'
import { createStructuredSelector } from 'reselect'
import { sanitizeUrl } from '@braintree/sanitize-url'
import * as M from '@material-ui/core'

import * as Intercom from 'components/Intercom'
import Logo from 'components/Logo'
import * as style from 'constants/style'
import * as URLS from 'constants/urls'
import * as authSelectors from 'containers/Auth/selectors'
import * as BucketConfig from 'utils/BucketConfig'
import * as CatalogSettings from 'utils/CatalogSettings'
import * as Config from 'utils/Config'
import HashLink from 'utils/HashLink'
import * as NamedRoutes from 'utils/NamedRoutes'
import { useRoute } from 'utils/router'

import bg from './bg.png'

import Controls from './Controls'

const useLogoLinkStyles = M.makeStyles((t) => ({
  bgQuilt: {
    background: `left / 64px url(${bg})`,
  },
  bgCustom: {
    alignItems: 'center',
    // TODO: make UI component with this background, and DRY
    background: ({ backgroundColor }: { backgroundColor?: string }) =>
      backgroundColor || `left / 64px url(${bg})`,
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
  const cfg = Config.useConfig()
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

const selectUser = createStructuredSelector({
  name: authSelectors.username,
  isAdmin: authSelectors.isAdmin,
})

const userDisplay = (user: $TSFixMe) => (
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

function UserDropdown() {
  const cfg = Config.useConfig()
  const user = redux.useSelector(selectUser)
  const { urls, paths } = NamedRoutes.use()
  const isProfile = !!useRoute(paths.profile, { exact: true }).match
  const isAdmin = !!useRoute(paths.admin).match
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

  return (
    <>
      <M.Button variant="text" color="inherit" onClick={open}>
        {userDisplay(user)} <M.Icon>expand_more</M.Icon>
      </M.Button>

      <M.MuiThemeProvider theme={style.appTheme}>
        <M.Menu anchorEl={anchor} open={!!anchor} onClose={close}>
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

interface AuthHamburgerProps {
  authenticated: boolean
  waiting: boolean
  error: boolean
}

function AuthHamburger({ authenticated, waiting, error }: AuthHamburgerProps) {
  const cfg = Config.useConfig()
  const user = redux.useSelector(selectUser)
  const { urls, paths } = NamedRoutes.use()
  const isProfile = !!useRoute(paths.profile, { exact: true }).match
  const isAdmin = !!useRoute(paths.admin).match
  const ham = useHam()
  const links = useLinks()
  return ham.render([
    ...// eslint-disable-next-line no-nested-ternary
    (authenticated
      ? [
          <M.MenuItem key="user" component="div">
            {userDisplay(user)}
          </M.MenuItem>,
          user.isAdmin && (
            <Item key="admin" to={urls.admin()} onClick={ham.close} selected={isAdmin}>
              <M.Box component="span" pr={2} />
              <M.Icon fontSize="small">security</M.Icon>
              &nbsp;Admin settings
            </Item>
          ),
          cfg.mode === 'OPEN' && (
            <Item
              key="profile"
              to={urls.profile()}
              onClick={ham.close}
              selected={isProfile}
            >
              <M.Box component="span" pr={2} />
              Profile
            </Item>
          ),
          <Item key="signout" to={urls.signOut()} onClick={ham.close}>
            <M.Box component="span" pr={2} />
            Sign Out
          </Item>,
        ]
      : waiting
      ? [
          <Item onClick={ham.close} key="progress">
            <M.CircularProgress />
          </Item>,
        ]
      : [
          <Item to={urls.signIn()} onClick={ham.close} key="sign-in">
            {error && (
              <>
                <M.Icon>error_outline</M.Icon>{' '}
              </>
            )}
            Sign In
          </Item>,
        ]),
    <M.Divider key="divider" />,
    ...links.map(({ label, ...rest }) => (
      <Item key={`${label}:${rest.to || rest.href}`} {...rest} onClick={ham.close}>
        {label}
      </Item>
    )),
  ])
}

function LinksHamburger() {
  const ham = useHam()
  return ham.render(
    useLinks().map(({ label, ...rest }) => (
      <Item key={`${label}:${rest.to || rest.href}`} {...rest} onClick={ham.close}>
        {label}
      </Item>
    )),
  )
}

const useSignInStyles = M.makeStyles((t) => ({
  icon: {
    marginRight: t.spacing(1),
  },
}))

interface AuthError {
  message: string
}

interface SignInProps {
  error?: AuthError
  waiting: boolean
}

function SignIn({ error, waiting }: SignInProps) {
  const classes = useSignInStyles()
  const { urls } = NamedRoutes.use()
  if (waiting) {
    return <M.CircularProgress color="inherit" />
  }
  return (
    <>
      {error && (
        <M.Icon
          title={`${error.message}\n${JSON.stringify(error)}`}
          className={classes.icon}
        >
          error_outline
        </M.Icon>
      )}
      <M.Button component={Link} to={urls.signIn()} variant="contained" color="primary">
        Sign In
      </M.Button>
    </>
  )
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
      backgroundColor || `left / 64px url(${bg})`,
    flex: '50%',
  },
  bgQuilt: {
    background: `left / 64px url(${bg})`,
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

const useContainerStyles = M.makeStyles(() => ({
  container: {
    display: 'flex',
    alignItems: 'center',
  },
  main: {
    alignItems: 'center',
    background: `left / 64px url(${bg})`,
    borderRadius: '16px 0 0 0',
    display: 'flex',
    flexGrow: 1,
    minHeight: '64px',
    paddingLeft: ({ customBg }: { customBg: boolean }) => (customBg ? '32px' : undefined),
  },
}))

interface ContainerProps {
  children?: React.ReactNode
}

export function Container({ children }: ContainerProps) {
  const trigger = M.useScrollTrigger()
  const settings = CatalogSettings.use()
  const classes = useContainerStyles({
    customBg: !!settings?.theme?.palette?.primary?.main,
  })
  return (
    <M.MuiThemeProvider theme={style.navTheme}>
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
    </M.MuiThemeProvider>
  )
}

interface NavLinkOwnProps {
  to?: string
  path?: string
}

type NavLinkProps = NavLinkOwnProps & M.BoxProps

const NavLink = React.forwardRef((props: NavLinkProps, ref: React.Ref<unknown>) => {
  const isActive = !!useRoute(props.path, { exact: true }).match
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
  const cfg = Config.useConfig()
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
}))

export function NavBar() {
  const cfg = Config.use()
  const settings = CatalogSettings.use()
  const bucket = BucketConfig.useCurrentBucket()
  const { paths } = NamedRoutes.use()
  const isSignIn = !!useRoute(paths.signIn, { exact: true }).match
  const { error, waiting, authenticated } = redux.useSelector(selector)
  const t = M.useTheme()
  const useHamburger = M.useMediaQuery(t.breakpoints.down('sm'))
  const links = useLinks()
  const intercom = Intercom.use()
  const classes = useNavBarStyles()
  return (
    <Container>
      {cfg.disableNavigator || (cfg.alwaysRequiresAuth && isSignIn) ? (
        <div className={classes.spacer} />
      ) : (
        <Controls {...{ bucket, disableSearch: cfg.mode === 'LOCAL' }} />
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

      {!cfg.disableNavigator &&
        cfg.mode !== 'LOCAL' &&
        !useHamburger &&
        (authenticated ? (
          <UserDropdown />
        ) : (
          !isSignIn && <SignIn error={error} waiting={waiting} />
        ))}

      {useHamburger &&
        (cfg.disableNavigator || cfg.mode === 'LOCAL' ? (
          <LinksHamburger />
        ) : (
          <AuthHamburger {...{ authenticated, error, waiting }} />
        ))}

      {settings?.logo?.url && <QuiltLink className={classes.quiltLogo} />}
    </Container>
  )
}

export default NavBar
