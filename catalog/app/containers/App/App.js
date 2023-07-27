import * as R from 'ramda'
import * as React from 'react'
import { Switch, Redirect } from 'react-router-dom'
import * as RRDomCompat from 'react-router-dom-v5-compat'

import Placeholder from 'components/Placeholder'
import AbsRedirect from 'components/Redirect'
import cfg from 'constants/config'
import { isAdmin } from 'containers/Auth/selectors'
import requireAuth from 'containers/Auth/wrapper'
import { CatchNotFound, ThrowNotFound } from 'containers/NotFoundPage'
import * as NamedRoutes from 'utils/NamedRoutes'
import * as RT from 'utils/reactTools'

const protect = cfg.alwaysRequiresAuth ? requireAuth() : R.identity

const ProtectedThrowNotFound = protect(ThrowNotFound)

const redirectTo = (path) => () => {
  const { search } = RRDomCompat.useLocation()
  return <Redirect to={`${path}${search}`} />
}

const Activate = () => {
  const { token } = RRDomCompat.useParams()
  const { urls } = NamedRoutes.use()
  return <AbsRedirect url={urls.activate({ registryUrl: cfg.registryUrl, token })} />
}

const LegacyPackages = () => {
  const l = RRDomCompat.useLocation()
  const { urls } = NamedRoutes.use()
  return <AbsRedirect url={urls.legacyPackages(cfg.legacyPackagesRedirect, l)} />
}

const requireAdmin = requireAuth({ authorizedSelector: isAdmin })
const Admin = requireAdmin(RT.mkLazy(() => import('containers/Admin'), Placeholder))

const AuthActivationError = RT.mkLazy(
  () => import('containers/Auth/ActivationError'),
  Placeholder,
)
const AuthCode = requireAuth()(
  RT.mkLazy(() => import('containers/Auth/Code'), Placeholder),
)
const AuthPassChange = RT.mkLazy(() => import('containers/Auth/PassChange'), Placeholder)
const AuthPassReset = RT.mkLazy(() => import('containers/Auth/PassReset'), Placeholder)
const AuthSignIn = RT.mkLazy(() => import('containers/Auth/SignIn'), Placeholder)
const AuthSignOut = RT.mkLazy(() => import('containers/Auth/SignOut'), Placeholder)
const AuthSignUp = RT.mkLazy(() => import('containers/Auth/SignUp'), Placeholder)
const Bucket = protect(RT.mkLazy(() => import('containers/Bucket'), Placeholder))
const Search = protect(RT.mkLazy(() => import('containers/Search'), Placeholder))
const UriResolver = protect(
  RT.mkLazy(() => import('containers/UriResolver'), Placeholder),
)

const Landing = RT.mkLazy(() => import('website/pages/Landing'), Placeholder)
const OpenLanding = RT.mkLazy(() => import('website/pages/OpenLanding'), Placeholder)
const OpenProfile = requireAuth()(
  RT.mkLazy(() => import('website/pages/OpenProfile'), Placeholder),
)
const Install = RT.mkLazy(() => import('website/pages/Install'), Placeholder)

const MAbout = RT.mkLazy(() => import('website/pages/About'), Placeholder)
const MPersonas = RT.mkLazy(() => import('website/pages/Personas'), Placeholder)
const MProduct = RT.mkLazy(() => import('website/pages/Product'), Placeholder)

const AwsMarketplace = RT.mkLazy(
  () => import('website/pages/AwsMarketplace'),
  Placeholder,
)
const Example = RT.mkLazy(() => import('website/pages/Example'), Placeholder)
const BioIT = RT.mkLazy(() => import('website/pages/BioIT'), Placeholder)
const NextFlow = RT.mkLazy(() => import('website/pages/NextFlow'), Placeholder)

const Home = protect(cfg.mode === 'OPEN' ? OpenLanding : Landing)

export default function App() {
  const { paths, urls } = NamedRoutes.use()
  const l = RRDomCompat.useLocation()

  return (
    <CatchNotFound id={`${l.pathname}${l.search}${l.hash}`}>
      <Switch>
        <RRDomCompat.CompatRoute path={paths.home} component={Home} exact />

        {process.env.NODE_ENV === 'development' && (
          <RRDomCompat.CompatRoute path={paths.example} component={Example} />
        )}

        {(cfg.mode === 'MARKETING' || cfg.mode === 'PRODUCT') && (
          <RRDomCompat.CompatRoute path={paths.install} component={Install} exact />
        )}

        {!!cfg.legacyPackagesRedirect && (
          <RRDomCompat.CompatRoute
            path={paths.legacyPackages}
            component={LegacyPackages}
          />
        )}

        {!cfg.disableNavigator && (
          <RRDomCompat.CompatRoute path={paths.search} component={Search} exact />
        )}

        {cfg.mode === 'MARKETING' && (
          <RRDomCompat.CompatRoute path={paths.about} component={MAbout} exact />
        )}
        {cfg.enableMarketingPages && (
          <RRDomCompat.CompatRoute path={paths.personas} component={MPersonas} exact />
        )}
        {cfg.enableMarketingPages && (
          <RRDomCompat.CompatRoute path={paths.product} component={MProduct} exact />
        )}
        {cfg.mode === 'MARKETING' && (
          <RRDomCompat.CompatRoute path="/bioit" component={BioIT} exact />
        )}
        {cfg.mode === 'MARKETING' && (
          <RRDomCompat.CompatRoute path="/nextflow" component={NextFlow} exact />
        )}
        {cfg.mode === 'MARKETING' && (
          <RRDomCompat.CompatRoute path="/aws" component={BioIT} exact />
        )}
        {cfg.mode === 'MARKETING' && (
          <RRDomCompat.CompatRoute
            path="/aws-marketplace"
            component={AwsMarketplace}
            exact
          />
        )}

        {!cfg.disableNavigator && (
          <RRDomCompat.CompatRoute path={paths.activate} component={Activate} exact />
        )}

        {!cfg.disableNavigator && (
          <RRDomCompat.CompatRoute path={paths.signIn} component={AuthSignIn} exact />
        )}
        {!cfg.disableNavigator && (
          <RRDomCompat.CompatRoute
            path="/login"
            component={redirectTo(urls.signIn())}
            exact
          />
        )}
        {!cfg.disableNavigator && (
          <RRDomCompat.CompatRoute path={paths.signOut} component={AuthSignOut} exact />
        )}
        {!cfg.disableNavigator && (cfg.passwordAuth === true || cfg.ssoAuth === true) && (
          <RRDomCompat.CompatRoute path={paths.signUp} component={AuthSignUp} exact />
        )}
        {!cfg.disableNavigator && !!cfg.passwordAuth && (
          <RRDomCompat.CompatRoute
            path={paths.passReset}
            component={AuthPassReset}
            exact
          />
        )}
        {!cfg.disableNavigator && !!cfg.passwordAuth && (
          <RRDomCompat.CompatRoute
            path={paths.passChange}
            component={AuthPassChange}
            exact
          />
        )}
        {!cfg.disableNavigator && (
          <RRDomCompat.CompatRoute path={paths.code} component={AuthCode} exact />
        )}
        {!cfg.disableNavigator && (
          <RRDomCompat.CompatRoute
            path={paths.activationError}
            component={AuthActivationError}
            exact
          />
        )}

        {cfg.mode === 'OPEN' && (
          <RRDomCompat.CompatRoute path={paths.profile} component={OpenProfile} exact />
        )}

        {!cfg.disableNavigator && (
          <RRDomCompat.CompatRoute path={paths.admin} component={Admin} />
        )}

        {!cfg.disableNavigator && (
          <RRDomCompat.CompatRoute path={paths.uriResolver} component={UriResolver} />
        )}

        {!cfg.disableNavigator && (
          <RRDomCompat.CompatRoute path={paths.bucketRoot} component={Bucket} />
        )}

        <RRDomCompat.CompatRoute component={ProtectedThrowNotFound} />
      </Switch>
    </CatchNotFound>
  )
}
