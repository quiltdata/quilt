import * as R from 'ramda'
import * as React from 'react'
import * as redux from 'react-redux'

import * as Config from 'utils/Config'
import usePrevious from 'utils/usePrevious'

import { SELECTOR } from './Launcher'

const canUseDOM = !!(
  typeof window !== 'undefined' &&
  window.document &&
  window.document.createElement
)

function dummyIntercomApi(...args) {
  // eslint-disable-next-line no-console
  console.log("Trying to call Intercom, but it's unavailable", args)
}
dummyIntercomApi.dummy = true
dummyIntercomApi.isCustom = false
dummyIntercomApi.isAvailable = () => false

const Ctx = React.createContext(dummyIntercomApi)

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

function APILoader({ appId, userSelector = defaultUserSelector, children, ...props }) {
  const settings = { app_id: appId, ...props }

  const cfg = Config.use()

  if (!window.Intercom) window.Intercom = mkPlaceholder()

  const { current: api } = React.useRef((...args) => window.Intercom(...args))
  if (!('dummy' in api)) api.dummy = false
  if (!('isAvailable' in api)) api.isAvailable = () => !!window.Intercom
  api.isCustom = cfg.mode === 'PRODUCT'

  if (api.isCustom) {
    settings.custom_launcher_selector = SELECTOR
    settings.hide_default_launcher = true
  }

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
    // run this only once, ignore settings changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const user = redux.useSelector(userSelector)

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

export function IntercomProvider({ children, ...props }) {
  const { intercomAppId: appId } = Config.useConfig()
  if (!canUseDOM || !appId) {
    return children
  }
  return (
    <APILoader appId={appId} {...props}>
      {(api) => <Ctx.Provider value={api}>{children}</Ctx.Provider>}
    </APILoader>
  )
}

export function useIntercom() {
  return React.useContext(Ctx)
}

export { IntercomProvider as Provider, useIntercom as use }

export function usePauseVisibilityWhen(condition) {
  const intercom = useIntercom()
  const [isVisible, setVisible] = React.useState(true)
  const showIntercom = React.useCallback(
    (shouldShow) => {
      if (isVisible === shouldShow) return
      intercom('update', {
        hide_default_launcher: !shouldShow,
      })
      setVisible(shouldShow)
    },
    [intercom, isVisible, setVisible],
  )
  React.useEffect(() => {
    if (condition) showIntercom(false)
    return () => showIntercom(true)
  }, [condition, showIntercom])
}
