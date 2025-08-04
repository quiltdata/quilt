import invariant from 'invariant'
import * as React from 'react'
import * as redux from 'react-redux'
import { createSelector } from 'reselect'
import * as Sentry from '@sentry/react'

import cfg from 'constants/config'
import { tokens as tokensSelector } from 'containers/Auth/selectors'
import { useApi } from 'utils/APIConnector'
import log from 'utils/Logging'

type Ensure = () => Promise<void>

const Ctx = React.createContext<Ensure | null>(null)

const selectToken = createSelector(
  tokensSelector,
  (tokens) => tokens?.token as string | undefined,
)

interface State {
  token: string | undefined
  lastRequest: Promise<void>
  state: 'pending' | 'success' | 'error'
}

export function PFSCookieManager({ children }: React.PropsWithChildren<{}>) {
  const stateRef = React.useRef<State>()

  const req: (opts: any) => Promise<void> = useApi()

  const setPFSCookie = React.useCallback(
    (token: string | undefined) => {
      if (!token) {
        stateRef.current = { token, lastRequest: Promise.resolve(), state: 'success' }
        return stateRef.current.lastRequest
      }

      const cookieRequest = req({
        auth: { tokens: { token }, handleInvalidToken: false },
        url: `${cfg.s3Proxy}/browse/set_browse_cookie`,
        method: 'POST',
        credentials: 'include',
      }).catch((e: any) => {
        throw new Error(`Could not set PFS cookie: ${e.message}`)
      })

      stateRef.current = { token, lastRequest: cookieRequest, state: 'pending' }

      cookieRequest
        .then(
          () => 'success' as const,
          () => 'error' as const,
        )
        .then((state) => {
          // update the state only if it corresponds to this request
          // (concurrent request has not been issued in the meantime)
          if (stateRef.current?.lastRequest === cookieRequest) {
            stateRef.current.state = state
          }
        })

      return cookieRequest
    },
    [req, stateRef],
  )

  const store = redux.useStore()

  const ensure = React.useCallback<Ensure>(async () => {
    // issue a new request if not initialized or if previous request failed
    if (!stateRef.current || stateRef.current.state === 'error') {
      const token = selectToken(store.getState())
      setPFSCookie(token)
    }

    // wait for the state to stabilize in case another request(s)
    // issued concurrently by the update logic
    while (stateRef.current?.state === 'pending') {
      await stateRef.current.lastRequest.catch(() => {})
    }
    return stateRef.current?.lastRequest
  }, [store, stateRef, setPFSCookie])

  // refresh cookie on token change
  React.useEffect(
    () =>
      store.subscribe(() => {
        const state = stateRef.current
        // bail if not initialized
        if (!state) return

        const token = selectToken(store.getState())
        // bail if token hasn't changed
        if (state.token === token) return

        // set new cookie and replace the stored request
        setPFSCookie(token).catch((e) => {
          log.error(e)
          Sentry.captureException(e)
        })
      }),
    [store, stateRef, setPFSCookie],
  )

  return <Ctx.Provider value={ensure}>{children}</Ctx.Provider>
}

export function useEnsurePFSCookie(): Ensure {
  const ctx = React.useContext(Ctx)
  invariant(ctx, 'useEnsurePFSCookie must be used within PFSCookieManager')
  return ctx
}
