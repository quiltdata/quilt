import PT from 'prop-types'
import * as R from 'ramda'
import * as React from 'react'
import { Link, Route } from 'react-router-dom'
import { HashLink } from 'react-router-hash-link'
import * as RC from 'recompose'
import * as reduxHook from 'redux-react-hook'
import { createStructuredSelector } from 'reselect'
import * as M from '@material-ui/core'
import { useTheme } from '@material-ui/core/styles'
import { withStyles } from '@material-ui/styles'

import * as URLS from 'constants/urls'
import * as authSelectors from 'containers/Auth/selectors'
import * as Config from 'utils/Config'
import * as NamedRoutes from 'utils/NamedRoutes'
import { composeComponent } from 'utils/reactTools'

import logo from 'img/logo/horizontal-white.png'
import bg from './bg.png'

import BucketControls from './BucketControls'

const Logo = (props) => {
  const { urls } = NamedRoutes.use()
  return (
    <M.Box component={Link} height={36} mr={2} to={urls.home()} {...props}>
      <M.Box component="img" alt="Quilt logo" src={logo} height="100%" />
    </M.Box>
  )
}

const Item = composeComponent(
  'NavBar.MenuItem',
  RC.withProps({ component: Link }),
  M.MenuItem,
)

const selectUser = createStructuredSelector({
  name: authSelectors.username,
  isAdmin: authSelectors.isAdmin,
})

const NavMenu = () => {
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
        {user.isAdmin && (
          <React.Fragment>
            <M.Icon fontSize="small">security</M.Icon>
            &nbsp;
          </React.Fragment>
        )}
        {user.name} <M.Icon>expand_more</M.Icon>
      </M.Button>
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
    </>
  )
}

const SignIn = composeComponent(
  'NavBar.SignIn',
  RC.setPropTypes({
    error: PT.object,
    waiting: PT.bool.isRequired,
  }),
  NamedRoutes.inject(),
  withStyles(({ spacing: { unit } }) => ({
    icon: {
      marginRight: unit,
    },
  })),
  ({ error, waiting, urls, classes }) => {
    if (waiting) {
      return <M.CircularProgress color="inherit" />
    }
    return (
      <React.Fragment>
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
      </React.Fragment>
    )
  },
)

export const Container = ({ children }) => {
  const t = useTheme()
  const trigger = M.useScrollTrigger()
  return (
    <M.Box>
      <M.Toolbar />
      <M.Slide appear={false} direction="down" in={!trigger}>
        <M.AppBar
          style={{
            color: t.palette.getContrastText(t.palette.primary.dark),
            background: `left / 64px url(${bg})`,
          }}
        >
          <M.Toolbar disableGutters>
            <M.Container maxWidth="lg" style={{ display: 'flex', alignItems: 'center' }}>
              <Logo />
              {children}
            </M.Container>
          </M.Toolbar>
        </M.AppBar>
      </M.Slide>
    </M.Box>
  )
}

const Spacer = composeComponent(
  'NavBar.Spacer',
  withStyles(() => ({
    root: {
      flexGrow: 1,
    },
  })),
  ({ classes }) => <div className={classes.root} />,
)

const whenNot = (path, fn) => (
  <Route path={path} exact>
    {({ match }) => !match && fn()}
  </Route>
)

const NavLink = (props) => (
  <M.Box
    component={props.to ? HashLink : 'a'}
    mr={3}
    color="text.secondary"
    fontSize="body2.fontSize"
    {...props}
  />
)

const Links = () => {
  const { urls } = NamedRoutes.use()
  const cfg = Config.useConfig()
  return (
    <M.Box component="nav" display="flex" alignItems="center">
      <NavLink href={URLS.docs}>Docs</NavLink>
      {!!cfg.enableMarketingPages && (
        <NavLink to={`${urls.home()}#pricing`}>Pricing</NavLink>
      )}
      <NavLink href={URLS.jobs}>Jobs</NavLink>
      <NavLink href={URLS.blog}>Blog</NavLink>
      {/*
      <NavLink to={urls.personas()}>Personas</NavLink>
      <NavLink to={urls.product()}>Product</NavLink>
      */}
      {!!cfg.enableMarketingPages && <NavLink to={urls.about()}>About</NavLink>}
    </M.Box>
  )
}

export const NavBar = () => {
  const selector = React.useCallback(
    createStructuredSelector(
      R.pick(['error', 'waiting', 'authenticated'], authSelectors),
    ),
    [],
  )
  const { error, waiting, authenticated } = reduxHook.useMappedState(selector)
  const { paths } = NamedRoutes.use()
  const t = useTheme()
  const useDrawer = M.useMediaQuery(t.breakpoints.down('sm'))
  const [drawer, setDrawer] = React.useState(false)
  const toggleDrawer = React.useCallback(() => setDrawer((d) => !d), [setDrawer])
  return (
    <Container>
      {whenNot(paths.signIn, () => !useDrawer && <BucketControls />)}
      <Spacer />
      {!useDrawer && <Links />}

      {authenticated ? (
        <NavMenu />
      ) : (
        whenNot(paths.signIn, () => <SignIn error={error} waiting={waiting} />)
      )}

      {useDrawer && (
        <M.Box ml={1}>
          <M.IconButton onClick={toggleDrawer} aria-label="Menu" edge="end">
            <M.Icon>menu</M.Icon>
          </M.IconButton>
        </M.Box>
      )}

      {useDrawer && (
        <M.SwipeableDrawer
          anchor="right"
          open={drawer}
          onClose={() => setDrawer(false)}
          onOpen={() => setDrawer(true)}
        >
          {/* TODO: populate the drawer with necessary controls / nav */}
          <M.Box px={1} width="calc(100vw - 4rem)" maxWidth={400}>
            <BucketControls />
            <Links />
          </M.Box>
        </M.SwipeableDrawer>
      )}
    </Container>
  )
}

export default NavBar
