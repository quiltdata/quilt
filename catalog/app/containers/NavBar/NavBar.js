import PT from 'prop-types'
import * as R from 'ramda'
import * as React from 'react'
import { connect } from 'react-redux'
import { Link, Route } from 'react-router-dom'
import * as RC from 'recompose'
import * as reduxHook from 'redux-react-hook'
import { createStructuredSelector } from 'reselect'
import {
  AppBar,
  Box,
  Button,
  CircularProgress,
  Icon,
  Menu,
  MenuItem,
  Toolbar,
} from '@material-ui/core'
import { withStyles } from '@material-ui/styles'

import LayoutContainer from 'components/Layout/Container'
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
  MenuItem,
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
      <Button variant="text" color="inherit" onClick={open}>
        {user.isAdmin && (
          <React.Fragment>
            <Icon fontSize="small">security</Icon>
            &nbsp;
          </React.Fragment>
        )}
        {user.name} <Icon>expand_more</Icon>
      </Button>
      <Menu anchorEl={anchor} open={!!anchor} onClose={close}>
        {user.isAdmin && (
          <Item to={urls.admin()} onClick={close} divider>
            <Icon fontSize="small">security</Icon>&nbsp;Users and roles
          </Item>
        )}
        <Item to={urls.signOut()} onClick={close}>
          Sign Out
        </Item>
      </Menu>
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
      return <CircularProgress color="inherit" />
    }
    return (
      <React.Fragment>
        {error && (
          <Icon
            title={`${error.message}\n${JSON.stringify(error)}`}
            className={classes.icon}
          >
            error_outline
          </Icon>
        )}
        <Button component={Link} to={urls.signIn()} variant="contained" color="primary">
          Sign In
        </Button>
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
    <AppBar className={classes.root} position="static">
      <Toolbar disableGutters>
        <LayoutContainer display="flex">
          <Logo />
          {children}
        </LayoutContainer>
      </Toolbar>
    </AppBar>
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
  <Box
    component={props.to ? Link : 'a'}
    mr={4}
    color="text.secondary"
    fontSize="body2.fontSize"
    {...props}
  />
)

const Links = () => {
  const { urls } = NamedRoutes.use()
  return (
    <Box component="nav" display="flex" alignItems="center">
      <NavLink href="EXT">Docs</NavLink>
      <NavLink to={`${urls.home()}#pricing`}>Pricing</NavLink>
      <NavLink href="EXT">Blog</NavLink>
      <NavLink href="EXT">Jobs</NavLink>
      <NavLink to={urls.personas()}>Personas</NavLink>
      <NavLink to={urls.product()}>Product</NavLink>
      <NavLink to={urls.about()}>About</NavLink>
    </Box>
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
