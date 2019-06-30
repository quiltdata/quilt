import * as R from 'ramda'
import * as React from 'react'
import { Switch, Route, Redirect } from 'react-router-dom'

import Placeholder from 'components/Placeholder'
import AbsRedirect from 'components/Redirect'
import { isAdmin } from 'containers/Auth/selectors'
import requireAuth from 'containers/Auth/wrapper'
import { CatchNotFound, ThrowNotFound } from 'containers/NotFoundPage'
import * as Config from 'utils/Config'
import * as NamedRoutes from 'utils/NamedRoutes'
import { loadable } from 'utils/reactTools'
import { useLocation } from 'utils/router'

const redirectTo = (path) => ({ location: { search } }) => (
  <Redirect to={`${path}${search}`} />
)

const requireAdmin = requireAuth({ authorizedSelector: isAdmin })

const Activate = ({
  match: {
    params: { token },
  },
}) => {
  const { registryUrl } = Config.useConfig()
  const { urls } = NamedRoutes.use()
  return <AbsRedirect url={urls.activate({ registryUrl, token })} />
}

const mkLazy = (load) => loadable(load, { fallback: () => <Placeholder /> })

const Admin = mkLazy(() => import('containers/Admin'))
const AuthActivationError = mkLazy(() => import('containers/Auth/ActivationError'))
const AuthCode = mkLazy(() => import('containers/Auth/Code'))
const AuthPassChange = mkLazy(() => import('containers/Auth/PassChange'))
const AuthPassReset = mkLazy(() => import('containers/Auth/PassReset'))
const AuthSignIn = mkLazy(() => import('containers/Auth/SignIn'))
const AuthSignOut = mkLazy(() => import('containers/Auth/SignOut'))
const AuthSignUp = mkLazy(() => import('containers/Auth/SignUp'))
const AuthSSOSignUp = mkLazy(() => import('containers/Auth/SSOSignUp'))
const Bucket = mkLazy(() => import('containers/Bucket'))
const HomePage = mkLazy(() => import('containers/HomePage'))

export default () => {
  const cfg = Config.useConfig()
  const protect = React.useMemo(
    () => (cfg.alwaysRequiresAuth ? requireAuth() : R.identity),
    [cfg.alwaysRequiresAuth],
  )
  const { paths, urls } = NamedRoutes.use()
  const l = useLocation()

  return (
    <CatchNotFound id={`${l.pathname}${l.search}${l.hash}`}>
      <Switch>
        <Route path={paths.home} component={protect(HomePage)} exact />

        <Route path={paths.activate} component={Activate} exact />

        <Route path={paths.signIn} component={AuthSignIn} exact />
        <Route path="/login" component={redirectTo(urls.signIn())} exact />
        <Route path={paths.signOut} component={AuthSignOut} exact />
        {(cfg.passwordAuth === true || cfg.ssoAuth === true) && (
          <Route path={paths.signUp} component={AuthSignUp} exact />
        )}
        {cfg.ssoAuth === true && (
          <Route path={paths.ssoSignUp} component={AuthSSOSignUp} exact />
        )}
        {!!cfg.passwordAuth && (
          <Route path={paths.passReset} component={AuthPassReset} exact />
        )}
        {!!cfg.passwordAuth && (
          <Route path={paths.passChange} component={AuthPassChange} exact />
        )}
        <Route path={paths.code} component={protect(AuthCode)} exact />
        <Route path={paths.activationError} component={AuthActivationError} exact />

        <Route path={paths.admin} component={requireAdmin(Admin)} exact />

        <Route path={paths.bucketRoot} component={protect(Bucket)} />

        <Route component={protect(ThrowNotFound)} />
      </Switch>
    </CatchNotFound>
  )
}
