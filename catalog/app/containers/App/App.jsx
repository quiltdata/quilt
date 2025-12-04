import * as R from 'ramda'
import * as React from 'react'
import { Switch, Route, Redirect, useLocation, useParams } from 'react-router-dom'

import Placeholder from 'components/Placeholder'
import AbsRedirect from 'components/Redirect'
import cfg from 'constants/config'
import { isAdmin } from 'containers/Auth/selectors'
import requireAuth from 'containers/Auth/wrapper'
import { NotFoundPage } from 'containers/NotFound'
import * as NamedRoutes from 'utils/NamedRoutes'
import parseSearch from 'utils/parseSearch'
import * as RT from 'utils/reactTools'

const protect = cfg.alwaysRequiresAuth ? requireAuth() : R.identity

function RedirectTo({ path }) {
  const { search } = useLocation()
  return <Redirect to={`${path}${search}`} />
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
  return <Redirect to={url} />
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
const Redir = protect(RT.mkLazy(() => import('containers/Redir'), Placeholder))
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

const Home = protect(cfg.mode === 'OPEN' ? OpenLanding : Landing)

export default function App() {
  const { paths, urls } = NamedRoutes.use()

  return (
    <Switch>
      <Route path={paths.home} exact>
        <Home />
      </Route>

      <Route path={paths.install} exact>
        <Install />
      </Route>

      {!!cfg.legacyPackagesRedirect && (
        <Route path={paths.legacyPackages}>
          <LegacyPackages />
        </Route>
      )}

      <Route path={paths.search} exact>
        <Search />
      </Route>

      <Route path={paths.activate} exact>
        <Activate />
      </Route>
      <Route path={paths.signIn} exact>
        <AuthSignIn />
      </Route>
      <Route path="/login" exact>
        <RedirectTo path={urls.signIn()} />
      </Route>
      <Route path={paths.signOut} exact>
        <AuthSignOut />
      </Route>

      {(cfg.passwordAuth === true || cfg.ssoAuth === true) && (
        <Route path={paths.signUp} exact>
          <AuthSignUp />
        </Route>
      )}
      {!!cfg.passwordAuth && (
        <Route path={paths.passReset} exact>
          <AuthPassReset />
        </Route>
      )}
      {!!cfg.passwordAuth && (
        <Route path={paths.passChange} exact>
          <AuthPassChange />
        </Route>
      )}

      <Route path={paths.code} exact>
        <AuthCode />
      </Route>

      <Route path={paths.activationError} exact>
        <AuthActivationError />
      </Route>

      {cfg.mode === 'OPEN' && (
        // XXX: show profile in all modes?
        <Route path={paths.profile} exact>
          <OpenProfile />
        </Route>
      )}

      <Route path={paths.admin}>
        <Admin />
      </Route>

      <Route path={paths.uriResolver}>
        <UriResolver />
      </Route>

      <Route path={paths.bucketSearch} exact>
        <BucketSearchRedirect />
      </Route>

      <Route path={paths.bucketRoot}>
        <Bucket />
      </Route>

      <Route path={paths.redir}>
        <Redir />
      </Route>

      <Route>
        <NotFoundPage />
      </Route>
    </Switch>
  )
}
