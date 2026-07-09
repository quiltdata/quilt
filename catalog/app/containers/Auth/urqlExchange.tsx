import * as R from 'ramda'
import * as React from 'react'
import * as redux from 'react-redux'
import * as urql from 'urql'
import * as W from 'wonka'

import defer from 'utils/defer'

import * as actions from './actions'
import { InvalidToken } from './errors'
import * as selectors from './selectors'

interface AuthTokens {
  token: string
}

interface AuthOptions {
  tokens?: boolean | AuthTokens
  handleInvalidToken?: boolean
}

interface AuthContext {
  auth?: boolean | AuthOptions
}

// TODO: dedupe
const makeHeadersFromTokens = (t?: AuthTokens) => t && { Authorization: t.token }

const getFetchOptions = (op: urql.Operation) =>
  typeof op.context.fetchOptions === 'function'
    ? op.context.fetchOptions()
    : op.context.fetchOptions || {}

// A registry 401 means the request could not be authenticated — the
// credential was missing, invalid, or its server-side SSO refresh failed.
// The registry collapses every such failure to a single 401 (403 is
// reserved for authenticated-but-forbidden), so the HTTP status is the
// whole signal; the specific error message is not load-bearing.
export const isAuthLost = (error?: urql.CombinedError) => error?.response?.status === 401

// A freshly-mounted SPA can fire GraphQL queries that race the
// post-OAuth-callback login handshake: such a query carries no credential
// (there is no session yet) and lands a 401 while sign-in is still in
// flight. Suppress the redirect only in that exact shape — waiting AND no
// credential was sent — so the handshake can finish. A 401 on a request
// that *did* carry a credential is a genuinely dead session (e.g. a failed
// SSO refresh), so it must still redirect.
export const isHandshakeRace = (waiting: boolean, authAttached: boolean) =>
  waiting && !authAttached

export function useAuthExchange() {
  const dispatch = redux.useDispatch()

  // Subscribe so the ref stays current; handleResult reads it
  // synchronously when a response lands. It can't take `waiting` as a
  // dependency without re-creating the exchange and tearing down
  // in-flight operations.
  const waiting = redux.useSelector(selectors.waiting)
  const waitingRef = React.useRef(waiting)
  waitingRef.current = waiting

  const getTokens = React.useCallback(() => {
    const { resolver, promise } = defer<AuthTokens>()
    dispatch(actions.getTokens(resolver))
    return promise
  }, [dispatch])

  const transformOp = React.useCallback(
    async (op: urql.Operation) => {
      const ctx: AuthContext = op.context as any

      const tokens =
        typeof ctx.auth === 'boolean' ? ctx.auth : R.defaultTo(ctx.auth?.tokens, true)

      const actualTokens: AuthTokens | undefined =
        tokens === true ? await getTokens() : tokens || undefined

      const authHeaders = makeHeadersFromTokens(actualTokens)

      const fetchOptions = getFetchOptions(op)

      // Record whether we actually sent a credential, so handleResult can
      // tell a racing unauthenticated request (post-OAuth handshake) apart
      // from a genuinely rejected session. See isHandshakeRace.
      const context = {
        ...op.context,
        authAttached: !!authHeaders,
        fetchOptions: {
          ...fetchOptions,
          headers: { ...fetchOptions.headers, ...authHeaders },
        },
      }

      return urql.makeOperation(op.kind, op, context)
    },
    [getTokens],
  )

  const handleResult = React.useCallback(
    async (r: urql.OperationResult) => {
      if (r.error) {
        const ctx: AuthContext = r.operation.context as any

        const handleInvalidToken =
          typeof ctx.auth === 'boolean'
            ? ctx.auth
            : R.defaultTo(ctx.auth?.handleInvalidToken, true)

        if (handleInvalidToken && isAuthLost(r.error)) {
          const authAttached = Boolean((r.operation.context as any).authAttached)
          if (isHandshakeRace(waitingRef.current, authAttached)) {
            // let the in-flight sign-in handshake complete rather than
            // bouncing a query that raced it
            return r
          }
          dispatch(actions.authLost(new InvalidToken({ originalError: r.error })))
          // never resolve on auth error
          return new Promise<urql.OperationResult>(() => {})
        }
      }
      return r
    },
    [dispatch],
  )

  return React.useCallback(
    ({ forward }: urql.ExchangeInput): urql.ExchangeIO =>
      (ops$) =>
        W.pipe(
          ops$,
          W.mergeMap((op) => W.fromPromise(transformOp(op))),
          forward,
          W.mergeMap((result) => W.fromPromise(handleResult(result))),
        ),
    [transformOp, handleResult],
  )
}
