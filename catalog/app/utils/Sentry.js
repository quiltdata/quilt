import * as R from 'ramda'
import * as React from 'react'
import * as reduxHook from 'redux-react-hook'

import * as Config from 'utils/Config'

const Ctx = React.createContext()

const dummy = async (method, args) => {
  // eslint-disable-next-line no-console
  console.log('Sentry(dummy):', method, args)
}

export const Provider = ({ children }) => {
  const sentryRef = React.useRef(Promise.resolve(dummy))
  const sentry = React.useCallback(
    R.curryN(2, (method, ...args) =>
      sentryRef.current.then((call) => call(method, ...args)),
    ),
    [],
  )
  return <Ctx.Provider value={{ sentry, sentryRef }}>{children}</Ctx.Provider>
}

export const Loader = ({ children, userSelector }) => {
  const { promise: cfgP } = Config.useConfig({ suspend: false })
  const { sentry, sentryRef } = React.useContext(Ctx)
  const user = reduxHook.useMappedState(userSelector)
  const userRef = React.useRef(user)

  React.useEffect(() => {
    sentryRef.current = cfgP.then((cfg) =>
      cfg.sentryDSN
        ? import('@sentry/browser').then((Sentry) => {
            Sentry.init({
              dsn: cfg.sentryDSN,
              // release: TODO
              environment: process.env.NODE_ENV === 'development' ? 'dev' : 'prod',
            })

            Sentry.configureScope((scope) => {
              scope.setExtra('config', cfg)
              if (userRef.current) scope.setUser(userRef.current)
            })

            return (method, ...args) => Sentry[method](...args)
          })
        : dummy,
    )
  }, [])

  React.useEffect(() => {
    if (!R.equals(user, userRef.current)) {
      userRef.current = user
      sentry('configureScope', (scope) => {
        scope.setUser(user)
      })
    }
  })

  return children
}

export const useSentry = () => React.useContext(Ctx).sentry

export const use = useSentry

export const Inject = ({ children }) => children(use())

export const inject = (prop = 'sentry') => (Component) => (props) => (
  <Component {...props} {...{ [prop]: use() }} />
)
