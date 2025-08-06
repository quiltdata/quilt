import * as Eff from 'effect'
import { Schema as S } from 'effect'
import * as React from 'react'
import * as RR from 'react-router-dom'

import bucketRoutes from 'containers/Bucket/Routes'
import search from 'containers/Search/Route'
import * as ROUTES from 'constants/routes'
import * as Log from 'utils/Logging'
import * as Nav from 'utils/Navigation'
import * as XML from 'utils/XML'

import * as Content from '../Content'
import * as Context from '../Context'
import * as Tool from '../Tool'

const MODULE = 'GlobalContext/navigation'

// the routes are in the order of matching
// TODO: specify/describe all the *relevant* routes
const routeList = [
  Nav.makeRoute({
    name: 'home',
    path: ROUTES.home.path,
    exact: true,
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
  ...bucketRoutes,
] as const

type KnownRoute = (typeof routeList)[number]
type KnownRouteMap = {
  [K in KnownRoute['name']]: Extract<KnownRoute, { name: K }>
}
export const routes = Object.fromEntries(
  routeList.map((r) => [r.name, r]),
) as KnownRouteMap

export const NavigableRouteSchema = S.Union(
  ...routeList.map((r) => r.navigableRouteSchema),
)

type NavigableRoute = typeof NavigableRouteSchema.Type

export const locationFromRoute = (route: NavigableRoute) =>
  // @ts-expect-error
  S.encode(routes[route.name].paramsSchema)(route.params)

type History = ReturnType<typeof RR.useHistory>

const WAIT_TIMEOUT = Eff.Duration.seconds(30)
const NAV_LAG = Eff.Duration.seconds(1)

const navigate = (
  route: NavigableRoute,
  history: History,
  markers: Eff.SubscriptionRef.SubscriptionRef<Record<string, boolean>>,
) =>
  Log.scoped({
    name: `${MODULE}.navigate`,
    enter: [`to: ${route.name}`, Log.br, 'params:', route.params],
  })(
    Eff.pipe(
      locationFromRoute(route),
      Eff.Effect.tap((loc) => Eff.Effect.log(`Navigating to location:`, Log.br, loc)),
      Eff.Effect.andThen((loc) => Eff.Effect.sync(() => history.push(loc))),
      Eff.Effect.andThen(() =>
        Eff.Effect.gen(function* () {
          const { waitForMarkers } = routes[route.name]
          if (!waitForMarkers.length) return
          yield* Eff.Effect.log(`Waiting for markers: ${waitForMarkers.join(', ')}`)
          yield* Eff.Effect.sleep(NAV_LAG)
          yield* Eff.pipe(
            markers.changes,
            Eff.Stream.timeoutFail(() => ({ _tag: 'timeout' as const }), WAIT_TIMEOUT),
            Eff.Stream.runForEachWhile((currentMarkers) =>
              Eff.Effect.succeed(!waitForMarkers.every((k) => currentMarkers[k])),
            ),
            Eff.Effect.andThen(() => Eff.Effect.log('Markers found')),
            Eff.Effect.catchTag('timeout', () =>
              Eff.Effect.log(
                `Timed out after ${Eff.Duration.format(
                  WAIT_TIMEOUT,
                )} while waiting for markers`,
              ),
            ),
          )
        }),
      ),
    ),
  )

export interface Match {
  descriptor: KnownRoute
  decoded: NavigableRoute | null
}

export const matchLocation = (loc: typeof Nav.Location.Type): Match | null =>
  Eff.pipe(
    Eff.Array.findFirst(routeList, (route) =>
      RR.matchPath(loc.pathname, {
        path: route.path,
        exact: route.exact,
        strict: route.strict,
      })
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

export function useRouteContext() {
  const loc = RR.useLocation()

  const match = React.useMemo(
    () => matchLocation({ pathname: loc.pathname, search: loc.search, hash: '' }),
    [loc.pathname, loc.search],
  )

  const description = React.useMemo(() => {
    if (!match) return ''
    const params = match.decoded?.params
      ? XML.tag('parameters', {}, JSON.stringify(match.decoded.params, null, 2))
      : null
    return XML.tag(
      'route-info',
      {},
      `Name: "${match.descriptor.name}"`,
      XML.tag('description', {}, match.descriptor.description),
      params,
    )
  }, [match])

  const msg = React.useMemo(
    () =>
      XML.tag(
        'viewport',
        {},
        XML.tag('current-location', {}, JSON.stringify(loc, null, 2)),
        description,
        'Refer to "navigate" tool schema for navigable routes and their parameters.',
      ).toString(),
    [description, loc],
  )

  return msg
}

export const NavigateSchema = S.Struct({
  route: NavigableRouteSchema,
}).annotations({
  title: 'navigate the catalog',
  description: 'navigate to a provided route',
})

export function useNavigate() {
  const history = RR.useHistory()
  const markers = Context.useMarkersRef()

  return Tool.useMakeTool(
    NavigateSchema,
    ({ route }) =>
      Eff.pipe(
        navigate(route, history, markers),
        Eff.Effect.match({
          onSuccess: () =>
            Tool.succeed(Content.text(`Navigating to the '${route.name}' route.`)),
          onFailure: (e) =>
            Tool.fail(
              Content.text(`Failed to navigate to the '${route.name}' route: ${e}`),
            ),
        }),
        Eff.Effect.map(Eff.Option.some),
      ),
    [history, markers],
  )
}
