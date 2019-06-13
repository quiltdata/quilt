import PT from 'prop-types'
import * as R from 'ramda'
import * as React from 'react'
import { connect } from 'react-redux'
import { Link, Route } from 'react-router-dom'
import { HashLink } from 'react-router-hash-link'
import * as RC from 'recompose'
import * as reduxHook from 'redux-react-hook'
import { createStructuredSelector } from 'reselect'
import * as M from '@material-ui/core'
import { withStyles } from '@material-ui/styles'

import * as URLS from 'constants/urls'
import * as authSelectors from 'containers/Auth/selectors'
import * as Config from 'utils/Config'
import * as NamedRoutes from 'utils/NamedRoutes'
import { composeComponent } from 'utils/reactTools'

import logo from 'img/logo/horizontal-white.png'
import bg from './bg.png'

import BucketControls from './BucketControls'

const Logo = composeComponent(
  'NavBar.Logo',
  NamedRoutes.inject(),
  withStyles(({ spacing: { unit } }) => ({
    root: {
      height: unit * 4.5,
      marginRight: unit * 2,
    },
    img: {
      height: '100%',
    },
  })),
  ({ classes, urls }) => (
    <Link className={classes.root} to={urls.home()}>
      <img className={classes.img} alt="Quilt logo" src={logo} />
    </Link>
  ),
)

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
    <div>
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
    </div>
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

export const Container = composeComponent(
  'NavBar.Container',
  withStyles(({ palette }) => ({
    root: {
      background: `left / 64px url(${bg})`,
      color: palette.getContrastText(palette.primary.dark),
    },
  })),
  ({ classes, children }) => (
    <M.AppBar className={classes.root} position="static">
      <M.Toolbar disableGutters>
        <M.Container maxWidth="lg" style={{ display: 'flex' }}>
          <Logo />
          {children}
        </M.Container>
      </M.Toolbar>
    </M.AppBar>
  ),
)

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
    mr={4}
    color="text.secondary"
    fontSize="body2.fontSize"
    {...props}
  />
)

const Links = () => {
  const { urls } = NamedRoutes.use()
  return (
    <M.Box component="nav" display="flex" alignItems="center">
      <NavLink href={URLS.docs}>Docs</NavLink>
      <NavLink to={`${urls.home()}#pricing`}>Pricing</NavLink>
      <NavLink href={URLS.jobs}>Jobs</NavLink>
      <NavLink href={URLS.blog}>Blog</NavLink>
      {/*
      <NavLink to={urls.personas()}>Personas</NavLink>
      <NavLink to={urls.product()}>Product</NavLink>
      */}
      <NavLink to={urls.about()}>About</NavLink>
    </M.Box>
  )
}

export const NavBar = composeComponent(
  'NavBar',
  connect(
    createStructuredSelector(
      R.pick(['error', 'waiting', 'authenticated'], authSelectors),
    ),
    undefined,
    undefined,
    { pure: false },
  ),
  ({ error, waiting, authenticated }) => {
    const { paths } = NamedRoutes.use()
    const cfg = Config.useConfig()
    return (
      <Container>
        {whenNot(paths.signIn, () => (
          <BucketControls />
        ))}
        <Spacer />
        {!!cfg.enableMarketingPages && <Links />}
        {authenticated ? (
          <NavMenu />
        ) : (
          whenNot(paths.signIn, () => <SignIn error={error} waiting={waiting} />)
        )}
      </Container>
    )
  },
)

export default NavBar
