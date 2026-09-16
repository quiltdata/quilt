import * as R from 'ramda'
import * as React from 'react'
import { Switch, Route, Redirect, useLocation, useParams } from 'react-router-dom'

import Placeholder from 'components/Placeholder'
import AbsRedirect from 'components/Redirect'
import cfg from 'constants/config'
import * as URLS from 'constants/urls'
import { isAdmin } from 'containers/Auth/selectors'
import requireAuth from 'containers/Auth/wrapper'
import { NotFoundPage } from 'containers/NotFound'
import * as NamedRoutes from 'utils/NamedRoutes'
import { useFeature } from 'utils/features'
import parseSearch from 'utils/parseSearch'
import * as RT from 'utils/reactTools'

import { BucketQueriesRedirect } from './queryRedirects'

const protect = cfg.alwaysRequiresAuth ? requireAuth() : R.identity

function RedirectTo({ path }) {
  const { search } = useLocation()
  return <Redirect to={`${path}${search}`} />
}

// /install leaves the SPA for the installation docs — react-router's
// <Redirect> can't navigate off-app, so this hits the browser API directly.
function InstallDocsRedirect() {
  React.useEffect(() => {
    window.location.replace(URLS.install)
  }, [])
  return null
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
const ConnectAuthorize = requireAuth()(
  RT.mkLazy(() => import('containers/Connect'), Placeholder),
)
const Bucket = protect(RT.mkLazy(() => import('containers/Bucket'), Placeholder))
// Data products always required an authenticated actor, so gate on auth
// regardless of the app-level protect mode. Note `Bucket` above is `protect`,
// which on an OPEN stack is the identity: the product screens keep their own
// `requireAuth` so moving them onto the bucket route does not silently downgrade
// them.
const Exchange = requireAuth()(
  RT.mkLazy(
    () => import('containers/DataProducts').then((m) => ({ default: m.ExchangeScreen })),
    Placeholder,
  ),
)
const NewProduct = requireAuth()(
  RT.mkLazy(
    () =>
      import('containers/DataProducts').then((m) => ({ default: m.NewProductScreen })),
    Placeholder,
  ),
)
const VolumeRoute = RT.mkLazy(
  () => import('containers/DataProducts/VolumeRoute'),
  Placeholder,
)

/**
 * The flag must be read ahead of `requireAuth`: auth redirects to sign-in first,
 * which discloses a flagged-off surface to an anonymous visitor on an OPEN stack.
 * Redirects home, matching the screen, so flag-off lands in one place either way.
 */
function ProductScreenRoute({ children }) {
  const { urls } = NamedRoutes.use()
  const enabled = useFeature('data-products')
  if (!enabled) return <Redirect to={urls.home()} />
  return children
}

/**
 * `/b/:bucket` for both volume kinds.
 *
 * With the flag off this renders `<Bucket />` and nothing else — the same component
 * tree as before, so a bucket page is byte-identical to `dev`. With it on, the kind
 * decides: a product mounts its own layout, and anything that is not a product falls
 * through to `Bucket` untouched.
 *
 * The flag read is what keeps a flag-off deployment from paying for a volume lookup
 * on every bucket navigation.
 */
function BucketOrProductRoute() {
  const enabled = useFeature('data-products')
  if (!enabled) return <Bucket />
  return (
    <VolumeRouteBoundary>
      <Bucket />
    </VolumeRouteBoundary>
  )
}

function VolumeRouteBoundary({ children }) {
  const { bucket } = useParams()
  return <VolumeRoute bucket={bucket}>{children}</VolumeRoute>
}
const Queries = requireAuth()(RT.mkLazy(() => import('containers/Queries'), Placeholder))
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

const BucketList = protect(
  RT.mkLazy(() => import('website/pages/Landing/BucketList'), Placeholder),
)

const Home = protect(cfg.mode === 'OPEN' ? OpenLanding : Landing)

export default function App() {
  const { paths, urls } = NamedRoutes.use()

  return (
    <Switch>
      <Route path={paths.home} exact>
        <Home />
      </Route>

      <Route path={paths.buckets} exact>
        <BucketList />
      </Route>

      <Route path={paths.install} exact>
        <InstallDocsRedirect />
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

      <Route path={paths.connectAuthorize} exact>
        <ConnectAuthorize />
      </Route>

      <Route path={paths.profile} exact>
        <OpenProfile />
      </Route>

      <Route path={paths.admin}>
        <Admin />
      </Route>

      <Route path={paths.uriResolver}>
        <UriResolver />
      </Route>

      <Route path={paths.bucketSearch} exact>
        <BucketSearchRedirect />
      </Route>

      {/* Registered unconditionally; each reads the flag before auth can redirect
          to sign-in, so a flagged-off surface is never disclosed to an anonymous
          visitor on an OPEN stack. */}
      <Route path={paths.exchange} exact>
        <ProductScreenRoute>
          <Exchange />
        </ProductScreenRoute>
      </Route>

      <Route path={paths.productNew} exact>
        <ProductScreenRoute>
          <NewProduct />
        </ProductScreenRoute>
      </Route>

      {/* The pre-pivot family, kept as a redirect so old links land on the volume
          list rather than a 404. */}
      <Route path={paths.dataProductsLegacy}>
        <RedirectTo path={urls.buckets()} />
      </Route>

      <Route path={paths.queries}>
        <Queries />
      </Route>

      <Route path={paths.bucketQueries}>
        <BucketQueriesRedirect />
      </Route>

      {/* Both volume kinds. Flag off, this is `<Bucket />` and nothing else. */}
      <Route path={paths.bucketRoot}>
        <BucketOrProductRoute />
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
