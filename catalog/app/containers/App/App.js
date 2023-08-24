import * as R from 'ramda'
import * as React from 'react'
import { Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom'

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
  const { search } = useLocation()
  return <Navigate to={`${path}${search}`} />
}

const Activate = () => {
  const { token } = useParams()
  const { urls } = NamedRoutes.use()
  return <AbsRedirect url={urls.activate({ registryUrl: cfg.registryUrl, token })} />
}

const LegacyPackages = () => {
  const l = useLocation()
  const { urls } = NamedRoutes.use()
  return <AbsRedirect url={urls.legacyPackages(cfg.legacyPackagesRedirect, l)} />
}

function BucketSearchRedirect() {
  const { search } = useLocation()
  const { bucket } = useParams()
  const { urls } = NamedRoutes.use()
  const params = parseSearch(search, true)
  const url = urls.search({ buckets: bucket, ...params })
  return <Navigate to={url} />
}

const requireAdmin = requireAuth({ authorizedSelector: isAdmin })
const Admin = requireAdmin(RT.mkLazy(() => import('containers/Admin'), Placeholder))
//
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

// FIXME: remove Install, MPersonas, MProduct

export default function App() {
  const { paths, urls } = NamedRoutes.use()
  const l = useLocation()

  return (
    <CatchNotFound id={`${l.pathname}${l.search}${l.hash}`}>
      <Routes>
        <Route path={paths.home} element={<Home />} />

        {process.env.NODE_ENV === 'development' && (
          <Route path={paths.example} element={<Example />} />
        )}

        {(cfg.mode === 'MARKETING' || cfg.mode === 'PRODUCT') && (
          <Route path={paths.install} element={<Install />} />
        )}

        {!!cfg.legacyPackagesRedirect && (
          <Route path={paths.legacyPackages} element={<LegacyPackages />} />
        )}

        {!cfg.disableNavigator && <Route path={paths.search} element={<Search />} />}

        {cfg.mode === 'MARKETING' && <Route path={paths.about} element={<MAbout />} />}
        {cfg.enableMarketingPages && (
          <Route path={paths.personas} element={<MPersonas />} />
        )}
        {cfg.enableMarketingPages && (
          <Route path={paths.product} element={<MProduct />} />
        )}
        {cfg.mode === 'MARKETING' && <Route path="/bioit" element={<BioIT />} />}
        {cfg.mode === 'MARKETING' && <Route path="/nextflow" element={<NextFlow />} />}
        {cfg.mode === 'MARKETING' && <Route path="/aws" element={<BioIT />} />}
        {cfg.mode === 'MARKETING' && (
          <Route path="/aws-marketplace" element={<AwsMarketplace />} />
        )}

        {!cfg.disableNavigator && <Route path={paths.activate} element={<Activate />} />}

        {!cfg.disableNavigator && <Route path={paths.signIn} element={<AuthSignIn />} />}
        {!cfg.disableNavigator && (
          <Route path="/login" element={<RedirectTo path={urls.signIn()} />} />
        )}
        {!cfg.disableNavigator && (
          <Route path={paths.signOut} element={<AuthSignOut />} />
        )}
        {!cfg.disableNavigator && (cfg.passwordAuth === true || cfg.ssoAuth === true) && (
          <Route path={paths.signUp} element={<AuthSignUp />} />
        )}
        {!cfg.disableNavigator && !!cfg.passwordAuth && (
          <Route path={paths.passReset} element={<AuthPassReset />} />
        )}
        {!cfg.disableNavigator && !!cfg.passwordAuth && (
          <Route path={paths.passChange} element={<AuthPassChange />} />
        )}
        {!cfg.disableNavigator && <Route path={paths.code} element={<AuthCode />} />}
        {!cfg.disableNavigator && (
          <Route path={paths.activationError} element={<AuthActivationError />} />
        )}

        {cfg.mode === 'OPEN' && <Route path={paths.profile} element={<OpenProfile />} />}

        {!cfg.disableNavigator && <Route path={paths.admin} element={<Admin />} />}

        {!cfg.disableNavigator && (
          <Route path={paths.uriResolver} element={<UriResolver />} />
        )}

        {!cfg.disableNavigator && (
          <Route path={paths.bucketSearch} element={<BucketSearchRedirect />} />
        )}
        {!cfg.disableNavigator && <Route path={paths.bucketRoot} element={<Bucket />} />}

        <Route path="*" element={<ProtectedThrowNotFound />} />
      </Routes>
    </CatchNotFound>
  )
}
