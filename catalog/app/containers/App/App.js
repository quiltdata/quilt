import * as R from 'ramda'
import * as React from 'react'
import { Switch, Route, Redirect } from 'react-router-dom'

import Placeholder from 'components/Placeholder'
import AbsRedirect from 'components/Redirect'
import cfg from 'constants/config'
import { isAdmin } from 'containers/Auth/selectors'
import requireAuth from 'containers/Auth/wrapper'
import { CatchNotFound, ThrowNotFound } from 'containers/NotFoundPage'
import * as NamedRoutes from 'utils/NamedRoutes'
import * as RT from 'utils/reactTools'
import { useLocation } from 'utils/router'

const protect = cfg.alwaysRequiresAuth ? requireAuth() : R.identity

const ProtectedThrowNotFound = protect(ThrowNotFound)

const SuspensePlaceholder = () => <Placeholder color="text.secondary" />
const StoryBook = RT.mkLazy(() => import('containers/StoryBook'), SuspensePlaceholder)

const redirectTo =
  (path) =>
  ({ location: { search } }) =>
    <Redirect to={`${path}${search}`} />

const Activate = ({
  match: {
    params: { token },
  },
}) => {
  const { urls } = NamedRoutes.use()
  return <AbsRedirect url={urls.activate({ registryUrl: cfg.registryUrl, token })} />
}

const LegacyPackages = ({ location: l }) => {
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
const AuthSSOSignUp = RT.mkLazy(() => import('containers/Auth/SSOSignUp'), Placeholder)
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

const Example = RT.mkLazy(() => import('website/pages/Example'), Placeholder)
const BioIT = RT.mkLazy(() => import('website/pages/BioIT'), Placeholder)
const NextFlow = RT.mkLazy(() => import('website/pages/NextFlow'), Placeholder)
const ISV = RT.mkLazy(() => import('website/pages/Isv'), Placeholder)

const Home = protect(cfg.mode === 'OPEN' ? OpenLanding : Landing)

export default function App() {
  const { paths, urls } = NamedRoutes.use()
  const l = useLocation()

  return (
    <CatchNotFound id={`${l.pathname}${l.search}${l.hash}`}>
      <Switch>
        <Route path={paths.home} component={Home} exact />

        {process.env.NODE_ENV === 'development' && (
          <Route path={paths.example} component={Example} />
        )}

        {(cfg.mode === 'MARKETING' || cfg.mode === 'PRODUCT') && (
          <Route path={paths.install} component={Install} exact />
        )}

        {!!cfg.legacyPackagesRedirect && (
          <Route path={paths.legacyPackages} component={LegacyPackages} />
        )}

        {!cfg.disableNavigator && <Route path={paths.search} component={Search} exact />}

        {cfg.mode === 'MARKETING' && (
          <Route path={paths.about} component={MAbout} exact />
        )}
        {cfg.enableMarketingPages && (
          <Route path={paths.personas} component={MPersonas} exact />
        )}
        {cfg.enableMarketingPages && (
          <Route path={paths.product} component={MProduct} exact />
        )}
        {cfg.mode === 'MARKETING' && <Route path="/bioit" component={BioIT} exact />}
        {cfg.mode === 'MARKETING' && (
          <Route path="/nextflow" component={NextFlow} exact />
        )}
        {cfg.mode === 'MARKETING' && <Route path="/aws" component={BioIT} exact />}
        {cfg.mode === 'MARKETING' && (
          <Route path="/quilt-and-aws" component={ISV} exact />
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
        {!cfg.disableNavigator && <Route path={paths.code} component={AuthCode} exact />}
        {!cfg.disableNavigator && (
          <Route path={paths.activationError} component={AuthActivationError} exact />
        )}

        {cfg.mode === 'OPEN' && (
          <Route path={paths.profile} component={OpenProfile} exact />
        )}

        {!cfg.disableNavigator && <Route path={paths.admin} component={Admin} />}

        {!cfg.disableNavigator && (
          <Route path={paths.uriResolver} component={UriResolver} />
        )}

        {!cfg.disableNavigator && <Route path={paths.bucketRoot} component={Bucket} />}

        {process.env.NODE_ENV !== 'production' && (
          <Route path={paths.storyBook} component={StoryBook} exact />
        )}

        <Route component={ProtectedThrowNotFound} />
      </Switch>
    </CatchNotFound>
  )
}
