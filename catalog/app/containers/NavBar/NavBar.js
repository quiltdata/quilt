import PT from 'prop-types'
import * as R from 'ramda'
import * as React from 'react'
import { Link } from 'react-router-dom'
import * as RC from 'recompose'
import * as reduxHook from 'redux-react-hook'
import { createStructuredSelector } from 'reselect'
import * as M from '@material-ui/core'

import Logo from 'components/Logo'
import * as style from 'constants/style'
import * as URLS from 'constants/urls'
import * as authSelectors from 'containers/Auth/selectors'
import * as BucketConfig from 'utils/BucketConfig'
import * as Config from 'utils/Config'
import HashLink from 'utils/HashLink'
import * as NamedRoutes from 'utils/NamedRoutes'
import { composeComponent } from 'utils/reactTools'
import { useRoute } from 'utils/router'

import bg from './bg.png'

import Controls from './Controls'

const LogoLink = (props) => {
  const { urls } = NamedRoutes.use()
  return (
    <M.Box component={Link} mr={2} to={urls.home()} {...props}>
      <Logo responsive />
    </M.Box>
  )
}

const Item = React.forwardRef((props, ref) => (
  <M.MenuItem
    // eslint-disable-next-line no-nested-ternary
    component={props.to ? Link : props.href ? 'a' : undefined}
    ref={ref}
    {...props}
  />
))

const selectUser = createStructuredSelector({
  name: authSelectors.username,
  isAdmin: authSelectors.isAdmin,
})

const userDisplay = (user) => (
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

const UserDropdown = () => {
  const user = reduxHook.useMappedState(selectUser)
  const { urls } = NamedRoutes.use()
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
            <Item to={urls.admin()} onClick={close} divider>
              <M.Icon fontSize="small">security</M.Icon>&nbsp;Users and roles
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

const useHam = () => {
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

  const render = (children) => (
    <>
      <M.IconButton onClick={open} aria-label="Menu" edge="end">
        <M.Icon>menu</M.Icon>
      </M.IconButton>
      <M.MuiThemeProvider theme={style.appTheme}>
        <M.Menu
          anchorEl={anchor}
          open={!!anchor}
          onClose={close}
          MenuListProps={{
            component: 'nav',
            style: { minWidth: 120 },
          }}
        >
          {children}
        </M.Menu>
      </M.MuiThemeProvider>
    </>
  )

  return { open, close, render }
}

const AuthHamburger = ({ authenticated, waiting, error }) => {
  const user = reduxHook.useMappedState(selectUser)
  const { urls } = NamedRoutes.use()
  const ham = useHam()

  return ham.render([
    ...// eslint-disable-next-line no-nested-ternary
    (authenticated
      ? [
          <M.MenuItem key="user" component="div">
            {userDisplay(user)}
          </M.MenuItem>,
          user.isAdmin && (
            <Item key="admin" to={urls.admin()} onClick={ham.close}>
              <M.Box component="span" pr={2} />
              <M.Icon fontSize="small">security</M.Icon>
              &nbsp;Users and roles
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
    <Links key="links">
      {R.map(({ label, ...rest }) => (
        <Item key={`${label}:${rest.to || rest.href}`} {...rest}>
          {label}
        </Item>
      ))}
    </Links>,
  ])
}

const LinksHamburger = () =>
  useHam().render(
    <Links>
      {R.map(({ label, ...rest }) => (
        <Item key={`${label}:${rest.to || rest.href}`} {...rest}>
          {label}
        </Item>
      ))}
    </Links>,
  )

const SignIn = composeComponent(
  'NavBar.SignIn',
  RC.setPropTypes({
    error: PT.object,
    waiting: PT.bool.isRequired,
  }),
  NamedRoutes.inject(),
  M.withStyles(({ spacing: { unit } }) => ({
    icon: {
      marginRight: unit,
    },
  })),
  ({ error, waiting, urls, classes }) => {
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
  },
)

const AppBar = M.styled(M.AppBar)(({ theme: t }) => ({
  background: `left / 64px url(${bg})`,
  zIndex: t.zIndex.appBar + 1,
}))

export const Container = ({ children }) => {
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

const NavLink = (props) => (
  <M.Box
    component={props.to ? HashLink : 'a'}
    mr={2}
    color="text.secondary"
    fontSize="body2.fontSize"
    {...props}
  />
)

const Links = ({ children }) => {
  const { urls } = NamedRoutes.use()
  const cfg = Config.useConfig()
  return children(
    [
      { href: URLS.docs, label: 'Docs' },
      cfg.mode === 'MARKETING' && { to: `${urls.home()}#pricing`, label: 'Pricing' },
      cfg.mode !== 'PRODUCT' && { href: URLS.jobs, label: 'Jobs' },
      { href: URLS.blog, label: 'Blog' },
      cfg.enableMarketingPages && { to: urls.about(), label: 'About' },
    ].filter(Boolean),
  )
}

export const NavBar = () => {
  const cfg = Config.use()
  const bucket = BucketConfig.useCurrentBucket()
  const { paths } = NamedRoutes.use()
  const notSignIn = !useRoute(paths.signIn, { exact: true }).match
  const selector = React.useCallback(
    createStructuredSelector(
      R.pick(['error', 'waiting', 'authenticated'], authSelectors),
    ),
    [],
  )
  const { error, waiting, authenticated } = reduxHook.useMappedState(selector)
  const t = M.useTheme()
  const useHamburger = M.useMediaQuery(t.breakpoints.down('sm'))
  return (
    <Container>
      {cfg.disableNavigator ? <M.Box flexGrow={1} /> : <Controls bucket={bucket} />}
      {!useHamburger && (
        <M.Box component="nav" display="flex" alignItems="center" ml={3}>
          <Links>
            {R.map(({ label, ...rest }) => (
              <NavLink key={`${label}:${rest.to || rest.href}`} {...rest}>
                {label}
              </NavLink>
            ))}
          </Links>
        </M.Box>
      )}

      {!cfg.disableNavigator &&
        !useHamburger &&
        (authenticated ? (
          <UserDropdown />
        ) : (
          notSignIn && <SignIn error={error} waiting={waiting} />
        ))}

      {useHamburger &&
        (cfg.disableNavigator ? (
          <LinksHamburger {...{ authenticated, error, waiting }} />
        ) : (
          <AuthHamburger {...{ authenticated, error, waiting }} />
        ))}
    </Container>
  )
}

export default NavBar
