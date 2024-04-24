import * as dateFns from 'date-fns'
import invariant from 'invariant'
import * as React from 'react'
import * as redux from 'react-redux'
import { createSelector } from 'reselect'

import cfg from 'constants/config'
import { tokens as tokensSelector } from 'containers/Auth/selectors'
import { useApi } from 'utils/APIConnector'
import usePrevious from 'utils/usePrevious'

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
            data: { ttl },
          }).catch((e: any) => {
            throw new Error(`Could not set PFS cookie: ${e.message}`)
          })
        : Promise.resolve(),

    [req],
  )

  const token = redux.useSelector(selectToken)

  const ensure = React.useCallback<Ensure>(
    async (ttl: number, histeresis: number) => {
      const expires = dateFns.addSeconds(new Date(), ttl)
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
    [token, stateRef, setPFSCookie],
  )

  // refresh on token change
  usePrevious(token, (prev) => {
    if (token === prev) return
    if (!stateRef.current) return
    const now = new Date()
    const ttlLeft = Math.ceil((stateRef.current.expires.getTime() - now.getTime()) / 1000)
    if (ttlLeft <= 0) return
    stateRef.current.token = token
    stateRef.current.promise = setPFSCookie(token, ttlLeft)
  })

  return <Ctx.Provider value={ensure}>{children}</Ctx.Provider>
}

export function useEnsurePFSCookie(): Ensure {
  const ctx = React.useContext(Ctx)
  invariant(ctx, 'useEnsurePFSCookie must be used within PFSCookieManager')
  return ctx
}
