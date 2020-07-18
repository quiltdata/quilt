import { stringify } from 'querystring'

import * as R from 'ramda'
import * as React from 'react'

import { composeHOC, consume } from 'utils/reactTools'
import useMemoEq from 'utils/useMemoEq'

const Ctx = React.createContext()

export const mkSearch = R.pipe(
  R.reject(R.isNil),
  stringify,
  R.unless(R.isEmpty, R.concat('?')),
)

export const Provider = function NamedRoutesProvider({ routes, children }) {
  // using rest syntax here to cast module or some other object-like thing into plain object
  const value = useMemoEq(
    { ...routes },
    R.applySpec({
      paths: R.pluck('path'),
      urls: R.pluck('url'),
    }),
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

const expose = (key, prop, src) =>
  prop === false ? {} : { [prop == null || prop === true ? key : prop]: src[key] }

export const inject = ({ paths, urls } = {}) =>
  composeHOC(
    'NamedRoutes.inject',
    consume(Ctx, (named, props) => ({
      ...props,
      ...expose('paths', paths, named),
      ...expose('urls', urls, named),
    })),
  )

export const Inject = Ctx.Consumer

export const useNamedRoutes = () => React.useContext(Ctx)

export const use = useNamedRoutes
