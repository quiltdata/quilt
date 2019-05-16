import { stringify } from 'querystring'

import * as R from 'ramda'
import * as React from 'react'
import { withPropsOnChange } from 'recompose'

import { composeComponent, composeHOC, provide, consume } from 'utils/reactTools'

const Ctx = React.createContext()

export const mkSearch = R.pipe(
  R.reject(R.isNil),
  stringify,
  R.unless(R.isEmpty, R.concat('?')),
)

export const Provider = composeComponent(
  'NamedRoutes.Provider',
  // using rest syntax here to cast module or some other object-like thing
  // into plain object
  withPropsOnChange(['routes'], ({ routes: { ...routes } }) => ({
    paths: R.pluck('path', routes),
    urls: R.pluck('url', routes),
  })),
  provide(Ctx, R.pick(['paths', 'urls'])),
)

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
