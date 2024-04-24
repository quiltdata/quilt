import invariant from 'invariant'
import * as React from 'react'
import * as redux from 'react-redux'
import { createSelector } from 'reselect'
import * as Sentry from '@sentry/react'

import cfg from 'constants/config'
import { tokens as tokensSelector } from 'containers/Auth/selectors'
import { useApi } from 'utils/APIConnector'
import usePrevious from 'utils/usePrevious'

type Ensure = () => Promise<void>

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
    if (!token) throw new Error('Unable to set PFS cookie: not authenticated')

    try {
      await req({
        auth: { tokens: { token }, handleInvalidToken: false },
        url: `${cfg.s3Proxy}/browse/set_browse_cookie`,
        method: 'POST',
        credentials: 'include',
      })
    } catch (e: any) {
      Sentry.captureException(e)
      throw new Error(`Could not set PFS cookie: ${e.message}`)
    }
  }, [req, token])

  const ensure = React.useCallback(() => {
    if (!promiseRef.current) promiseRef.current = setBrowseCookie()
    return promiseRef.current
  }, [promiseRef, setBrowseCookie])

  // refresh on token change
  usePrevious(token, (prev) => {
    if (token !== prev && promiseRef.current) promiseRef.current = setBrowseCookie()
  })

  return <Ctx.Provider value={ensure}>{children}</Ctx.Provider>
}

export function useEnsurePFSCookie(): Ensure {
  const ctx = React.useContext(Ctx)
  invariant(ctx, 'useEnsurePFSCookie must be used within PFSCookieManager')
  return ctx
}
