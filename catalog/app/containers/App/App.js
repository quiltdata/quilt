import * as R from 'ramda'
import * as React from 'react'
import * as RR from 'react-router-dom'

import Placeholder from 'components/Placeholder'
import AbsRedirect from 'components/Redirect'
import cfg from 'constants/config'
import { isAdmin } from 'containers/Auth/selectors'
import requireAuth from 'containers/Auth/wrapper'
import { CatchNotFound, ThrowNotFound } from 'containers/NotFoundPage'
import * as NamedRoutes from 'utils/NamedRoutes'
import parseSearch from 'utils/parseSearch'
import * as RT from 'utils/reactTools'

const protect = cfg.alwaysRequiresAuth ? requireAuth() : R.identity

const ProtectedThrowNotFound = protect(ThrowNotFound)

function RedirectTo({ path }) {
  const { search } = RR.useLocation()
  return <RR.Redirect to={`${path}${search}`} />
}

const Activate = () => {
  const { token } = RR.useParams()
  const { urls } = NamedRoutes.use()
  return <AbsRedirect url={urls.activate({ registryUrl: cfg.registryUrl, token })} />
}

const LegacyPackages = () => {
  const l = RR.useLocation()
  const { urls } = NamedRoutes.use()
  return <AbsRedirect url={urls.legacyPackages(cfg.legacyPackagesRedirect, l)} />
}

function BucketSearchRedirect() {
  const { search } = RR.useLocation()
  const { bucket } = RR.useParams()
  const { urls } = NamedRoutes.use()
  const params = parseSearch(search, true)
  const url = urls.search({ buckets: bucket, ...params })
  return <RR.Redirect to={url} />
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
  const l = RR.useLocation()

  return (
    <CatchNotFound id={`${l.pathname}${l.search}${l.hash}`}>
      <RR.Switch>
        <RR.Route path={paths.home} exact>
          <Home />
        </RR.Route>

        {process.env.NODE_ENV === 'development' && (
          <RR.Route path={paths.example}>
            <Example />
          </RR.Route>
        )}

        {(cfg.mode === 'MARKETING' || cfg.mode === 'PRODUCT') && (
          <RR.Route path={paths.install} exact>
            <Install />
          </RR.Route>
        )}

        {!!cfg.legacyPackagesRedirect && (
          <RR.Route path={paths.legacyPackages}>
            <LegacyPackages />
          </RR.Route>
        )}

        {!cfg.disableNavigator && (
          <RR.Route path={paths.search} exact>
            <Search />
          </RR.Route>
        )}

        {cfg.mode === 'MARKETING' && (
          <RR.Route path={paths.about} exact>
            <MAbout />
          </RR.Route>
        )}
        {cfg.enableMarketingPages && (
          <RR.Route path={paths.personas} exact>
            <MPersonas />
          </RR.Route>
        )}
        {cfg.enableMarketingPages && (
          <RR.Route path={paths.product} exact>
            <MProduct />
          </RR.Route>
        )}
        {cfg.mode === 'MARKETING' && (
          <RR.Route path="/bioit" exact>
            <BioIT />
          </RR.Route>
        )}
        {cfg.mode === 'MARKETING' && (
          <RR.Route path="/nextflow" exact>
            <NextFlow />
          </RR.Route>
        )}
        {cfg.mode === 'MARKETING' && (
          <RR.Route path="/aws" exact>
            <BioIT />
          </RR.Route>
        )}
        {cfg.mode === 'MARKETING' && (
          <RR.Route path="/aws-marketplace" exact>
            <AwsMarketplace />
          </RR.Route>
        )}

        {!cfg.disableNavigator && (
          <RR.Route path={paths.activate} exact>
            <Activate />
          </RR.Route>
        )}

        {!cfg.disableNavigator && (
          <RR.Route path={paths.signIn} exact>
            <AuthSignIn />
          </RR.Route>
        )}
        {!cfg.disableNavigator && (
          <RR.Route path="/login" exact>
            <RedirectTo path={urls.signIn()} />
          </RR.Route>
        )}
        {!cfg.disableNavigator && (
          <RR.Route path={paths.signOut} exact>
            <AuthSignOut />
          </RR.Route>
        )}
        {!cfg.disableNavigator && (cfg.passwordAuth === true || cfg.ssoAuth === true) && (
          <RR.Route path={paths.signUp} exact>
            <AuthSignUp />
          </RR.Route>
        )}
        {!cfg.disableNavigator && !!cfg.passwordAuth && (
          <RR.Route path={paths.passReset} exact>
            <AuthPassReset />
          </RR.Route>
        )}
        {!cfg.disableNavigator && !!cfg.passwordAuth && (
          <RR.Route path={paths.passChange} exact>
            <AuthPassChange />
          </RR.Route>
        )}
        {!cfg.disableNavigator && (
          <RR.Route path={paths.code} exact>
            <AuthCode />
          </RR.Route>
        )}
        {!cfg.disableNavigator && (
          <RR.Route path={paths.activationError} exact>
            <AuthActivationError />
          </RR.Route>
        )}

        {cfg.mode === 'OPEN' && (
          <RR.Route path={paths.profile} exact>
            <OpenProfile />
          </RR.Route>
        )}

        {!cfg.disableNavigator && (
          <RR.Route path={paths.admin}>
            <Admin />
          </RR.Route>
        )}

        {!cfg.disableNavigator && (
          <RR.Route path={paths.uriResolver}>
            <UriResolver />
          </RR.Route>
        )}

        {!cfg.disableNavigator && (
          <RR.Route path={paths.bucketSearch} exact>
            <BucketSearchRedirect />
          </RR.Route>
        )}
        {!cfg.disableNavigator && (
          <RR.Route path={paths.bucketRoot}>
            <Bucket />
          </RR.Route>
        )}

        <RR.Route>
          <ProtectedThrowNotFound />
        </RR.Route>
      </RR.Switch>
    </CatchNotFound>
  )
}
