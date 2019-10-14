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

const LegacyPackages = ({ location: l }) => {
  const { legacyPackagesRedirect } = Config.useConfig()
  const { urls } = NamedRoutes.use()
  return <AbsRedirect url={urls.legacyPackages(legacyPackagesRedirect, l)} />
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
const Search = mkLazy(() => import('containers/Search'))

const Landing = mkLazy(() => import('website/pages/Landing'))
const OpenLanding = mkLazy(() => import('website/pages/OpenLanding'))

const MAbout = mkLazy(() => import('website/pages/About'))
const MPersonas = mkLazy(() => import('website/pages/Personas'))
const MProduct = mkLazy(() => import('website/pages/Product'))

export default function App() {
  const cfg = Config.useConfig()
  const protect = React.useMemo(
    () => (cfg.alwaysRequiresAuth ? requireAuth() : R.identity),
    [cfg.alwaysRequiresAuth],
  )
  const { paths, urls } = NamedRoutes.use()
  const l = useLocation()

  const Home = React.useMemo(() => protect(cfg.mode === 'OPEN' ? OpenLanding : Landing), [
    protect,
    cfg.mode,
  ])

  return (
    <CatchNotFound id={`${l.pathname}${l.search}${l.hash}`}>
      <Switch>
        <Route path={paths.home} component={Home} exact />

        {!!cfg.legacyPackagesRedirect && (
          <Route path={paths.legacyPackages} component={LegacyPackages} />
        )}

        {!cfg.disableNavigator && <Route path={paths.search} component={Search} exact />}

        {cfg.enableMarketingPages && (
          <Route path={paths.about} component={MAbout} exact />
        )}
        {cfg.enableMarketingPages && (
          <Route path={paths.personas} component={MPersonas} exact />
        )}
        {cfg.enableMarketingPages && (
          <Route path={paths.product} component={MProduct} exact />
        )}

        {!cfg.disableNavigator && (
          <Route path={paths.activate} component={Activate} exact />
        )}

        {!cfg.disableNavigator && (
          <Route path={paths.signIn} component={AuthSignIn} exact />
        )}
        {!cfg.disableNavigator && (
          <Route path="/login" component={redirectTo(urls.signIn())} exact />
        )}
        {!cfg.disableNavigator && (
          <Route path={paths.signOut} component={AuthSignOut} exact />
        )}
        {!cfg.disableNavigator && (cfg.passwordAuth === true || cfg.ssoAuth === true) && (
          <Route path={paths.signUp} component={AuthSignUp} exact />
        )}
        {!cfg.disableNavigator && cfg.ssoAuth === true && (
          <Route path={paths.ssoSignUp} component={AuthSSOSignUp} exact />
        )}
        {!cfg.disableNavigator && !!cfg.passwordAuth && (
          <Route path={paths.passReset} component={AuthPassReset} exact />
        )}
        {!cfg.disableNavigator && !!cfg.passwordAuth && (
          <Route path={paths.passChange} component={AuthPassChange} exact />
        )}
        {!cfg.disableNavigator && (
          <Route path={paths.code} component={protect(AuthCode)} exact />
        )}
        {!cfg.disableNavigator && (
          <Route path={paths.activationError} component={AuthActivationError} exact />
        )}

        {!cfg.disableNavigator && (
          <Route path={paths.admin} component={requireAdmin(Admin)} exact />
        )}

        {!cfg.disableNavigator && (
          <Route path={paths.bucketRoot} component={protect(Bucket)} />
        )}

        <Route component={protect(ThrowNotFound)} />
      </Switch>
    </CatchNotFound>
  )
}
