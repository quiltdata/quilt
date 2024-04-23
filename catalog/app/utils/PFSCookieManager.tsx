import invariant from 'invariant'
import * as React from 'react'
import * as redux from 'react-redux'
import { createSelector } from 'reselect'

import cfg from 'constants/config'
import { tokens as tokensSelector } from 'containers/Auth/selectors'
import { useApi } from 'utils/APIConnector'
import log from 'utils/Logging'
import usePrevious from 'utils/usePrevious'

type Ensure = () => void

const Ctx = React.createContext<Ensure | null>(null)

const selectToken = createSelector(
  tokensSelector,
  (tokens) => tokens?.token as string | undefined,
)

export function PFSCookieManager({ children }: React.PropsWithChildren<{}>) {
  const promiseRef = React.useRef<Promise<void>>()

  const req = useApi()

  const token = redux.useSelector(selectToken)

  const setBrowseCookie = React.useCallback(async () => {
    log.warn('Setting browse cookie', { token })
    // TODO
    if (!token) return

    try {
      await req({
        auth: { tokens: { token }, handleInvalidToken: false },
        url: `${cfg.s3Proxy}/browse/set_browse_cookie`,
        method: 'POST',
        credentials: 'include',
      })
    } catch (e) {
      log.warn('Unable to set browse cookie:', e)
      // Sentry.captureException(e)
      // throw?
    }
  }, [req, token])

  const ensure = React.useCallback(() => {
    if (!promiseRef.current) promiseRef.current = setBrowseCookie()
    return promiseRef.current
  }, [promiseRef, setBrowseCookie])

  // refresh on token change
  usePrevious(token, (prev) => {
    if (!!token && token !== prev && promiseRef.current) {
      promiseRef.current = setBrowseCookie()
    }
  })

  return <Ctx.Provider value={ensure}>{children}</Ctx.Provider>
}

export function useEnsurePFSCookie(): Ensure {
  const ctx = React.useContext(Ctx)
  invariant(ctx, 'useEnsurePFSCookie must be used within PFSCookieManager')
  return ctx
}
