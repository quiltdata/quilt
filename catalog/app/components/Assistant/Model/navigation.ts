import * as Eff from 'effect'
import * as React from 'react'
import * as RR from 'react-router-dom'
import { Schema as S } from '@effect/schema'

import search from 'containers/Search/Route'
import * as ROUTES from 'constants/routes'
import * as Log from 'utils/Logging'
import * as Nav from 'utils/Navigation'

const MODULE = 'Assistant/Model/navigation'

// the routes are in the order of matching
const routeList = [
  Nav.makeRoute({
    name: 'home',
    path: ROUTES.home.path,
    description: 'Home page',
    // searchParams: S.Struct({
    //   // XXX: passing this param doesn't actually work bc of how it's implemented in
    //   //      website/pages/Landing/Buckets/Buckets.js
    //   q: SearchParamLastOpt.annotations({
    //     title: 'bucket filter query',
    //     description: 'filter buckets in the bucket grid',
    //   }),
    // }),
  }),
  Nav.makeRoute({
    name: 'install',
    path: ROUTES.install.path,
    description: 'Installation page',
  }),
  search,
  Nav.makeRoute({
    name: 'activate',
    path: ROUTES.activate.path,
    description: 'TBD',
  }),
  //         <Route path={paths.signIn} exact>
  //           <AuthSignIn />
  //         </Route>
  //         <Route path="/login" exact>
  //           <RedirectTo path={urls.signIn()} />
  //         </Route>
  //
  //         <Route path={paths.signOut} exact>
  //           <AuthSignOut />
  //         </Route>
  //
  //         {(cfg.passwordAuth === true || cfg.ssoAuth === true) && (
  //           <Route path={paths.signUp} exact>
  //             <AuthSignUp />
  //           </Route>
  //         )}
  //         {!!cfg.passwordAuth && (
  //           <Route path={paths.passReset} exact>
  //             <AuthPassReset />
  //           </Route>
  //         )}
  //         {!!cfg.passwordAuth && (
  //           <Route path={paths.passChange} exact>
  //             <AuthPassChange />
  //           </Route>
  //         )}
  //
  //         <Route path={paths.code} exact>
  //           <AuthCode />
  //         </Route>
  //
  //         <Route path={paths.activationError} exact>
  //           <AuthActivationError />
  //         </Route>
  //
  //         {cfg.mode === 'OPEN' && (
  //           // XXX: show profile in all modes?
  //           <Route path={paths.profile} exact>
  //             <OpenProfile />
  //           </Route>
  //         )}
  //
  //         <Route path={paths.admin}>
  //           <Admin />
  //         </Route>
  //
  //         <Route path={paths.uriResolver}>
  //           <UriResolver />
  //         </Route>
  //
  Nav.makeRoute({
    name: 'bucket',
    path: ROUTES.bucketRoot.path,
    description: 'Bucket root page',
    // XXX: this should hold the bucket name and subroute info (e.g. package vs file view)
  }),
] as const

type KnownRoute = (typeof routeList)[number]
type KnownRouteMap = {
  [K in KnownRoute['name']]: Extract<KnownRoute, { name: K }>
}
const routes = Object.fromEntries(routeList.map((r) => [r.name, r])) as KnownRouteMap

export const NavigableRouteSchema = S.Union(
  ...routeList.map((r) => r.navigableRouteSchema),
)

export type NavigableRoute = typeof NavigableRouteSchema.Type

export type History = ReturnType<typeof RR.useHistory>

export const navigate = (route: NavigableRoute, history: History) =>
  Log.scoped({
    name: `${MODULE}.navigate`,
    enter: [`to: ${route.name}`, Log.br, 'params:', route.params],
  })(
    Eff.pipe(
      route.params,
      // @ts-expect-error
      S.encode(routes[route.name].paramsSchema),
      Eff.Effect.tap((loc) => Eff.Effect.log(`Navigating to location:`, Log.br, loc)),
      Eff.Effect.andThen((loc) => Eff.Effect.sync(() => history.push(loc))),
    ),
  )

interface Match {
  descriptor: KnownRoute
  decoded: NavigableRoute | null
}

const matchLocation = (loc: typeof Nav.Location.Type): Match | null =>
  Eff.pipe(
    Eff.Array.findFirst(routeList, (route) =>
      RR.matchPath(loc.pathname, { path: route.path, exact: true })
        ? Eff.Option.some(route)
        : Eff.Option.none(),
    ),
    Eff.Option.map((descriptor) => ({
      descriptor,
      decoded: Eff.pipe(
        loc,
        // @ts-expect-error
        S.decodeOption(descriptor.paramsSchema),
        Eff.Option.map((params) => ({ name: descriptor.name, params }) as NavigableRoute),
        Eff.Option.getOrNull,
      ),
    })),
    Eff.Option.getOrNull,
  )

interface LocationInfo {
  loc: typeof Nav.Location.Type
  match: Match | null
}

export function useCurrentRoute(): LocationInfo {
  const loc = RR.useLocation()
  const match = React.useMemo(
    () => matchLocation({ pathname: loc.pathname, search: loc.search, hash: '' }),
    [loc.pathname, loc.search],
  )
  return { match, loc }
}
