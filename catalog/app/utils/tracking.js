import * as R from 'ramda'
import * as React from 'react'
import * as reduxHook from 'redux-react-hook'

import * as Config from 'utils/Config'
import usePrevious from 'utils/usePrevious'

const loadMixpanel = (token) =>
  import('mixpanel-browser').then(({ default: mp }) => {
    mp.init(token)
    return mp
  })

const consoleTracker = Promise.resolve({
  // eslint-disable-next-line no-console
  track: (evt, opts) => console.log(`track: ${evt}`, opts),
})

const mkTracker = (token) => {
  const tracker = token ? loadMixpanel(token) : consoleTracker

  return {
    nav: (loc, user) =>
      tracker.then((inst) =>
        // use same distinct_id as registry for event attribution
        // else undefined to let mixpanel decide
        inst.track('WEB', {
          type: 'navigation',
          distinct_id: user || undefined,
          origin: window.location.origin,
          location: `${loc.pathname}${loc.search}${loc.hash}`,
          user,
        }),
      ),
  }
}

export default ({ locationSelector, userSelector, children }) => {
  const cfg = Config.useConfig()
  // workaround to avoid changing client configs
  const token = cfg.mixpanelToken || cfg.mixPanelToken

  const tracker = React.useMemo(() => mkTracker(token), [token])

  const selector = React.useCallback(
    R.applySpec({
      loc: locationSelector,
      u: userSelector,
    }),
    [locationSelector, userSelector],
  )

  const data = reduxHook.useMappedState(selector)

  usePrevious(data, (prev) => {
    if (!R.equals(data, prev)) {
      tracker.nav(data.loc, data.u)
    }
  })

  return children
}
