import * as Eff from 'effect'
import * as RR from 'react-router-dom'
import { Schema as S } from '@effect/schema'

import search from 'containers/Search/Route'
import * as ROUTES from 'constants/routes'
import * as Log from 'utils/Logging'
import * as Nav from 'utils/Navigation'

const MODULE = 'Assistant/Model/navigation'

const home = Nav.makeRoute({
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
})

const routeList = [home, search] as const
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
