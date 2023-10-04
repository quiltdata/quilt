import invariant from 'invariant'
import * as R from 'ramda'
import * as React from 'react'

import useMemoEq from 'utils/useMemoEq'

export { default as mkSearch } from 'utils/mkSearch'

type RouteMap = {
  [name: string]: any
}

type RoutesConfig<RMap extends RouteMap = RouteMap> = {
  [Name in keyof RMap]: {
    path: string
    url: (...args: RMap[Name]) => string
  }
}

type RouteMapFromConfig<Config> = Config extends RoutesConfig<infer RMap> ? RMap : never

export type Paths<RMap extends RouteMap> = {
  [Name in keyof RMap]: string
}

export type Urls<RMap extends RouteMap> = {
  [Name in keyof RMap]: (...args: RMap[Name]) => string
}

export type Routes<RMap extends RouteMap = RouteMap> = {
  paths: Paths<RMap>
  urls: Urls<RMap>
}

const Ctx = React.createContext<Routes | null>(null)

export const Provider = function NamedRoutesProvider<R extends RoutesConfig>({
  routes,
  children,
}: React.PropsWithChildren<{ routes: R }>) {
  // using rest syntax here to cast module or some other object-like thing into plain object
  const value = useMemoEq(
    // @ts-expect-error
    { ...routes },
    R.applySpec({
      paths: R.pluck('path'),
      urls: R.pluck('url'),
    }),
  ) as unknown as Routes<RouteMapFromConfig<R>>
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

// XXX: it's not possible to type the actual routes bc they are injected dymanically,
// solution would be to split routes definition (mapping of route names to route parameters)
// and route implementation (mapping of route names to urls),
// and then use route definitions as type parameters to this use() call
export function useNamedRoutes<RMap extends RouteMap = RouteMap>() {
  const value = React.useContext(Ctx) as Routes<RMap>
  invariant(!!value, 'Must have a NamedRoutesProvider somewhere up the component tree')
  return value
}

export const use = useNamedRoutes
