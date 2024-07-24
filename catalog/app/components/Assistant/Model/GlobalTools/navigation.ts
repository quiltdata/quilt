import * as Eff from 'effect'
import * as RR from 'react-router-dom'
import { Schema as S } from '@effect/schema'

import * as ROUTES from 'constants/routes'
import * as Log from 'utils/Logging'
import * as Nav from 'utils/Navigation'

import * as Content from '../Content'
import * as Tool from '../Tool'

const MODULE = 'GlobalTools/navigation'

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

const search = Nav.makeRoute({
  name: 'search' as const,
  path: ROUTES.home.path,
  description: 'Search page',
  // TODO: add search params
  // pathParams: emptyPathParams,
  // searchParams: emptySearchParams,
})

const routeList = [home, search] as const
type KnownRoute = (typeof routeList)[number]
type KnownRouteMap = {
  [K in KnownRoute['name']]: Extract<KnownRoute, { name: K }>
}
const routes = Object.fromEntries(routeList.map((r) => [r.name, r])) as KnownRouteMap

const NavigableRouteSchema = S.Union(...routeList.map((r) => r.navigableRouteSchema))

type NavigableRoute = typeof NavigableRouteSchema.Type

const NavigateSchema = S.Struct({
  route: NavigableRouteSchema,
}).annotations({
  title: 'navigate the catalog',
  description: 'navigate to a provided route',
})

type History = ReturnType<typeof RR.useHistory>

const navigate = (route: NavigableRoute, history: History) =>
  Log.scoped({
    name: `${MODULE}.navigate`,
    enter: [`to: ${route.name}`, Log.br, 'params:', route.params],
  })(
    Eff.pipe(
      route.params,
      S.encode(routes[route.name].paramsSchema),
      Eff.Effect.andThen((loc) => Eff.Effect.sync(() => history.push(loc))),
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
  )

export function useNavigate() {
  const history = RR.useHistory()
  return Tool.useMakeTool(NavigateSchema, ({ route }) => navigate(route, history), [
    history,
  ])
}
