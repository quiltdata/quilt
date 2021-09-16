import * as R from 'ramda'
import * as React from 'react'
import * as redux from 'react-redux'
import { Link } from 'react-router-dom'
import { createStructuredSelector } from 'reselect'
import * as M from '@material-ui/core'

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
  root: {
    margin: t.spacing(2),
  },
}))

function LogoLink() {
  const classes = useLogoLinkStyles()
  const cfg = Config.useConfig()
  const { urls } = NamedRoutes.use()
  return (
    <Link className={classes.root} to={urls.home()}>
      <Logo responsive forcedShort={cfg.mode === 'OPEN' || cfg.mode === 'PRODUCT'} />
    </Link>
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

const AppBar = M.styled(M.AppBar)(({ theme: t }) => ({
  background: `left / 64px url(${bg})`,
  zIndex: t.zIndex.appBar + 1,
}))

interface ContainerProps {
  children?: React.ReactNode
}

export function Container({ children }: ContainerProps) {
  const trigger = M.useScrollTrigger()
  return (
    <M.MuiThemeProvider theme={style.navTheme}>
      <M.Box>
        <M.Toolbar />
        <M.Slide appear={false} direction="down" in={!trigger}>
          <AppBar>
            <M.Toolbar disableGutters>
              <M.Container
                maxWidth="lg"
                style={{ display: 'flex', alignItems: 'center' }}
              >
                <LogoLink />
                {children}
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
      mr={2}
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
}

function useLinks(): LinkDescriptor[] {
  const { paths, urls } = NamedRoutes.use()
  const cfg = Config.useConfig()
  const settings = CatalogSettings.use()
  return [
    settings?.customNavLink && {
      href: settings.customNavLink.url,
      label: settings.customNavLink.label,
    },
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
    { href: URLS.blog, label: 'Blog' },
    cfg.mode === 'MARKETING' && { to: urls.about(), label: 'About' },
  ].filter(Boolean) as LinkDescriptor[]
}

const selector = createStructuredSelector(
  R.pick(['error', 'waiting', 'authenticated'], authSelectors),
)

export function NavBar() {
  const cfg = Config.use()
  const bucket = BucketConfig.useCurrentBucket()
  const { paths } = NamedRoutes.use()
  const isSignIn = !!useRoute(paths.signIn, { exact: true }).match
  const { error, waiting, authenticated } = redux.useSelector(selector)
  const t = M.useTheme()
  const useHamburger = M.useMediaQuery(t.breakpoints.down('sm'))
  const links = useLinks()
  return (
    <Container>
      {cfg.disableNavigator || (cfg.alwaysRequiresAuth && isSignIn) ? (
        <M.Box flexGrow={1} />
      ) : (
        <Controls {...{ bucket, disableSearch: cfg.mode === 'LOCAL' }} />
      )}
      {!useHamburger && (
        <M.Box component="nav" display="flex" alignItems="center" ml={3}>
          {links.map(({ label, ...rest }) => (
            <NavLink key={`${label}:${rest.to || rest.href}`} {...rest}>
              {label}
            </NavLink>
          ))}
        </M.Box>
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
    </Container>
  )
}

export default NavBar
