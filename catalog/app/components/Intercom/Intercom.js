import * as R from 'ramda'
import * as React from 'react'
import * as reduxHook from 'redux-react-hook'

import * as Config from 'utils/Config'
import usePrevious from 'utils/usePrevious'

const canUseDOM = !!(
  typeof window !== 'undefined' &&
  window.document &&
  window.document.createElement
)

const Ctx = React.createContext()

const mkPlaceholder = () => {
  const i = (...args) => i.c(args)
  i.q = []
  i.c = (args) => {
    i.q.push(args)
  }
  return i
}

// should return undefined or { name, email, user_id }
const defaultUserSelector = () => undefined

const IntercomProvider = ({
  appId,
  userSelector = defaultUserSelector,
  children,
  ...props
}) => {
  const settings = { app_id: appId, ...props }

  if (!window.Intercom) window.Intercom = mkPlaceholder()

  const api = React.useCallback((...args) => window.Intercom(...args), [])
  if (!('dummy' in api)) api.dummy = false

  React.useEffect(() => {
    api('boot', settings)

    const s = window.document.createElement('script')
    s.type = 'text/javascript'
    s.async = true
    s.src = `https://widget.intercom.io/widget/${appId}`
    const x = window.document.getElementsByTagName('script')[0]
    x.parentNode.insertBefore(s, x)

    return () => {
      if (!window.Intercom) return
      api('shutdown')
      delete window.Intercom
    }
  }, [])

  const user = reduxHook.useMappedState(userSelector)

  usePrevious(user, (prevUser) => {
    if (!R.equals(user, prevUser)) {
      if (!user) {
        api('shutdown')
        api('boot', settings)
      } else {
        api('update', { ...settings, ...user })
      }
    }
  })

  return children(api)
}

const DummyProvider = ({ children }) => {
  const api = React.useCallback((...args) => {
    // eslint-disable-next-line no-console
    console.log("Trying to call Intercom, but it's unavailable", args)
  }, [])
  if (!('dummy' in api)) api.dummy = true

  return children(api)
}

export const Provider = ({ children, ...props }) => {
  const { intercomAppId: appId } = Config.useConfig()
  const P = canUseDOM && appId ? IntercomProvider : DummyProvider
  return (
    <P appId={appId} {...props}>
      {(api) => <Ctx.Provider value={api}>{children}</Ctx.Provider>}
    </P>
  )
}

// eslint-disable-next-line react-hooks/rules-of-hooks
export const use = () => React.useContext(Ctx)
