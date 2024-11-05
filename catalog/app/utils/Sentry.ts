import type { History } from 'history'
import * as React from 'react'
import * as redux from 'react-redux'
import * as Sentry from '@sentry/react'

import * as AuthSelectors from 'containers/Auth/selectors'
import type { Config } from 'utils/Config'

const RELEASE = `catalog@${process.env.REVISION_HASH}`

export function init(cfg: Config, history?: History) {
  if (!cfg.sentryDSN) return false

  Sentry.init({
    dsn: cfg.sentryDSN,
    release: RELEASE,
    environment: process.env.NODE_ENV === 'development' ? 'dev' : 'prod',
    integrations: [
      history
        ? Sentry.reactRouterV5BrowserTracingIntegration({ history })
        : Sentry.browserTracingIntegration(),
      Sentry.extraErrorDataIntegration({ depth: 5 }),
      Sentry.linkedErrorsIntegration({ key: 'originalError' }),
    ],
    normalizeDepth: 10,
    // XXX: dial down in production? get from config?
    // tracesSampleRate: 1.0,
    denyUrls: ['//localhost', 'extension://'],
  })

  Sentry.setContext('config', cfg)

  return Sentry
}

interface User {
  username: string
  email: string
}

const userSelector = (state: $TSFixMe): User | null => {
  const { user: u } = AuthSelectors.domain(state)
  return u ? { username: u.current_user, email: u.email } : null
}

const userEq = (l: User | null, r: User | null) =>
  l === r || (l?.username === r?.username && l?.email === r?.email)

export const UserTracker = function SentryUserTracker({
  children,
}: React.PropsWithChildren<{}>) {
  const user = redux.useSelector(userSelector, userEq)
  const userRef = React.useRef<User | null>(null)

  React.useEffect(() => {
    if (!userEq(user, userRef.current)) {
      userRef.current = user
      Sentry.setUser(user)
    }
  })

  return children
}

/** @deprecated use '@sentry/react'  */
async function callSentry(method: string, ...args: $TSFixMe[]) {
  return (Sentry as $TSFixMe)[method](...args)
}

/** @deprecated use '@sentry/react' */
export const useSentry = () => callSentry

/** @deprecated use '@sentry/react'  */
export const use = useSentry
