import * as R from 'ramda'
import * as React from 'react'
import * as redux from 'react-redux'
import { matchPath, useLocation } from 'react-router-dom'

import cfg from 'constants/config'
import * as NamedRoutes from 'utils/NamedRoutes'
import usePrevious from 'utils/usePrevious'

const NAV_TIMEOUT = 500

const Ctx = React.createContext()

const consoleTracker = Promise.resolve({
  // eslint-disable-next-line no-console
  track: (evt, opts) => console.log(`track: ${evt}`, opts),
})

const loadMixpanel = () =>
  cfg.mixpanelToken
    ? import('mixpanel-browser').then(({ default: mp }) => {
        mp.init(cfg.mixpanelToken)
        return mp
      })
    : consoleTracker

function useMkLocation() {
  const {
    paths: { passChange: passChangePath },
    urls: { passChange: passChangeUrl },
  } = NamedRoutes.use()
  return React.useCallback(
    (l) => {
      const pathname = matchPath(l.pathname, { path: passChangePath, exact: true })
        ? passChangeUrl('REDACTED')
        : l.pathname

      return `${pathname}${l.search}${l.hash}`
    },
    [passChangePath, passChangeUrl],
  )
}

const delayNav = (e) => {
  const el = e.currentTarget
  if (e.which === 2 || e.metaKey || e.ctrlKey || el.target === '_blank') return () => {}
  e.preventDefault()
  return () => {
    window.location = el.href
  }
}

const withTimeout = (p, timeout) =>
  new Promise((resolve, reject) => {
    let settled = false
    const settle = (fn, a1) => (a2) => {
      if (settled) return
      settled = true
      fn(a1 != null ? a1 : a2)
    }
    setTimeout(settle(reject, new Error('Timed out')), timeout)
    p.then(settle(resolve), settle(reject))
  })

export function TrackingProvider({ userSelector, children }) {
  const tracker = React.useMemo(loadMixpanel, [])
  const mkLocation = useMkLocation()
  const location = mkLocation(useLocation())
  const user = redux.useSelector(userSelector)

  const commonOpts = React.useMemo(
    () => ({
      // use same distinct_id as registry for event attribution
      // else undefined to let mixpanel decide
      distinct_id: user || undefined,
      origin: window.location.origin,
      location,
      user,
      catalog_release: cfg.stackVersion,
    }),
    [location, user],
  )

  const track = React.useCallback(
    (evt, opts) =>
      tracker.then(
        (inst) =>
          new Promise((resolve) => inst.track(evt, { ...commonOpts, ...opts }, resolve)),
      ),
    [tracker, commonOpts],
  )

  const trackLink = React.useCallback(
    (evt, opts) => (e) => {
      const delayedNav = delayNav(e)
      withTimeout(track(evt, opts), NAV_TIMEOUT).then(delayedNav, delayedNav)
    },
    [track],
  )

  const instance = React.useMemo(() => ({ track, trackLink }), [track, trackLink])

  usePrevious({ location, user }, (prev) => {
    if (!R.equals({ location, user }, prev)) {
      track('WEB', { type: 'navigation' })
    }
  })

  return <Ctx.Provider value={instance}>{children}</Ctx.Provider>
}

export function useTracker() {
  return React.useContext(Ctx)
}

export { TrackingProvider as Provider, useTracker as use }
