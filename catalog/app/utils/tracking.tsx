import * as R from 'ramda'
import * as React from 'react'
import * as redux from 'react-redux'
import { matchPath, useLocation } from 'react-router-dom'
import type * as H from 'history'

import cfg from 'constants/config'
import * as NamedRoutes from 'utils/NamedRoutes'
import usePrevious from 'utils/usePrevious'

const NAV_TIMEOUT = 500

type TrackingOpts = Record<string, unknown>

interface TrackerInstance {
  track: (evt: string, opts?: TrackingOpts, cb?: () => void) => void
}

export interface Tracker {
  track: (evt: string, opts?: TrackingOpts) => Promise<void>
  trackLink: (
    evt: string,
    opts?: TrackingOpts,
  ) => (e: React.MouseEvent<HTMLElement>) => void
}

const Ctx = React.createContext<Tracker | null>(null)

const consoleTracker: Promise<TrackerInstance> = Promise.resolve({
  // eslint-disable-next-line no-console
  track: (evt: string, opts?: TrackingOpts) => console.log(`track: ${evt}`, opts),
})

const loadMixpanel = (): Promise<TrackerInstance> =>
  cfg.mixpanelToken
    ? import('mixpanel-browser').then(({ default: mp }) => {
        mp.init(cfg.mixpanelToken)
        return mp as unknown as TrackerInstance
      })
    : consoleTracker

function useMkLocation() {
  const {
    paths: { passChange: passChangePath },
    urls: { passChange: passChangeUrl },
  } = NamedRoutes.use()
  return React.useCallback(
    (l: H.Location) => {
      const pathname = matchPath(l.pathname, { path: passChangePath, exact: true })
        ? passChangeUrl('REDACTED')
        : l.pathname

      return `${pathname}${l.search}${l.hash}`
    },
    [passChangePath, passChangeUrl],
  )
}

const delayNav = (e: React.MouseEvent<HTMLElement>): (() => void) => {
  const el = e.currentTarget as HTMLAnchorElement
  if ((e as any).which === 2 || e.metaKey || e.ctrlKey || el.target === '_blank')
    return () => {}
  e.preventDefault()
  return () => {
    window.location.href = el.href
  }
}

const withTimeout = <T,>(p: Promise<T>, timeout: number): Promise<T> =>
  new Promise((resolve, reject) => {
    let settled = false
    const settle =
      <A,>(fn: (a: A) => void, a1?: A) =>
      (a2: A) => {
        if (settled) return
        settled = true
        fn(a1 != null ? a1 : a2)
      }
    setTimeout(settle(reject, new Error('Timed out')), timeout)
    p.then(settle(resolve), settle(reject))
  })

interface TrackingProviderProps {
  userSelector: (state: any) => unknown
  children: React.ReactNode
}

export function TrackingProvider({ userSelector, children }: TrackingProviderProps) {
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
    (evt: string, opts?: TrackingOpts) =>
      tracker.then(
        (inst) =>
          new Promise<void>((resolve) =>
            inst.track(evt, { ...commonOpts, ...opts }, resolve),
          ),
      ),
    [tracker, commonOpts],
  )

  const trackLink = React.useCallback(
    (evt: string, opts?: TrackingOpts) => (e: React.MouseEvent<HTMLElement>) => {
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
  return React.useContext(Ctx) as Tracker
}

export { TrackingProvider as Provider, useTracker as use }
