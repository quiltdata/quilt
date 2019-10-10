import * as R from 'ramda'
import * as React from 'react'
import * as reduxHook from 'redux-react-hook'

import * as Config from 'utils/Config'
import usePrevious from 'utils/usePrevious'

const Ctx = React.createContext()

const loadMixpanel = (token) =>
  import('mixpanel-browser').then(({ default: mp }) => {
    mp.init(token)
    return mp
  })

const consoleTracker = Promise.resolve({
  // eslint-disable-next-line no-console
  track: (evt, opts) => console.log(`track: ${evt}`, opts),
})

const mkLocation = (l) => `${l.pathname}${l.search}${l.hash}`

export function Provider({ locationSelector, userSelector, children }) {
  const cfg = Config.useConfig()
  // workaround to avoid changing client configs
  const token = cfg.mixpanelToken || cfg.mixPanelToken

  const tracker = React.useMemo(() => (token ? loadMixpanel(token) : consoleTracker), [
    token,
  ])

  const location = mkLocation(reduxHook.useMappedState(locationSelector))
  const user = reduxHook.useMappedState(userSelector)

  const commonOpts = React.useMemo(
    () => ({
      // use same distinct_id as registry for event attribution
      // else undefined to let mixpanel decide
      distinct_id: user || undefined,
      origin: window.location.origin,
      location,
      user,
    }),
    [location, user],
  )

  const track = React.useCallback(
    (evt, opts) => tracker.then((inst) => inst.track(evt, { ...commonOpts, ...opts })),
    [tracker, commonOpts],
  )

  usePrevious({ location, user }, (prev) => {
    if (!R.equals({ location, user }, prev)) {
      track('WEB', { type: 'navigation' })
    }
  })

  const instance = React.useMemo(() => ({ track }), [track])

  return <Ctx.Provider value={instance}>{children}</Ctx.Provider>
}

export const useTracker = () => React.useContext(Ctx)
