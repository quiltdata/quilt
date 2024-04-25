import * as dateFns from 'date-fns'
import invariant from 'invariant'
import * as React from 'react'
import * as redux from 'react-redux'
import { createSelector } from 'reselect'

import cfg from 'constants/config'
import { tokens as tokensSelector } from 'containers/Auth/selectors'
import { useApi } from 'utils/APIConnector'

type Ensure = (ttl: number, histeresis: number) => Promise<void>

const Ctx = React.createContext<Ensure | null>(null)

const selectToken = createSelector(
  tokensSelector,
  (tokens) => tokens?.token as string | undefined,
)

interface State {
  token: string | undefined
  expires: Date
  promise: Promise<void>
}

function needsRefresh(
  state: State | undefined,
  params: {
    token: string | undefined
    expires: Date
    histeresis: number
  },
): boolean {
  if (!state) return true
  if (state.token !== params.token) return true
  if (state.expires.getTime() + params.histeresis < params.expires.getTime()) return true
  return false
}

export function PFSCookieManager({ children }: React.PropsWithChildren<{}>) {
  const stateRef = React.useRef<State>()

  const req = useApi()

  const setPFSCookie = React.useCallback(
    (token: string | undefined, ttl: number): Promise<void> =>
      token
        ? req({
            auth: { tokens: { token }, handleInvalidToken: false },
            url: `${cfg.s3Proxy}/browse/set_browse_cookie`,
            method: 'POST',
            credentials: 'include',
            body: { ttl },
          }).catch((e: any) => {
            throw new Error(`Could not set PFS cookie: ${e.message}`)
          })
        : Promise.resolve(),
    [req],
  )

  const store = redux.useStore()

  const ensure = React.useCallback<Ensure>(
    async (ttl: number, histeresis: number) => {
      const expires = dateFns.addSeconds(new Date(), ttl)
      const token = selectToken(store.getState())
      if (needsRefresh(stateRef.current, { token, expires, histeresis })) {
        const promise = setPFSCookie(token, ttl)
        stateRef.current = { token, expires, promise }
      }
      while (true) {
        // if a new request has been issued while waiting for the response,
        // wait for it to complete
        let promise = stateRef.current?.promise
        if (promise) await promise
        if (promise === stateRef.current?.promise) return
      }
    },
    [store, stateRef, setPFSCookie],
  )

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

        const ttlLeft = Math.ceil((state.expires.getTime() - Date.now()) / 1000)
        // bail if cookie has expired (noone's using it)
        if (ttlLeft <= 0) return

        state.token = token
        state.promise = setPFSCookie(token, ttlLeft)
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
