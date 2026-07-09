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

export type AuthLossAction = 'redirect' | 'hold'

// Given an auth-loss 401 whose interception is enabled, decide between:
// - 'redirect' — a credential WAS sent and still 401'd, so the session is
//   dead; or there is no session and none is being established (logged out).
// - 'hold' — no credential was sent AND a session already exists or is being
//   established. The request is a stale straggler issued before the session,
//   or a query racing the post-OAuth handshake; bouncing it would log out a
//   live/arriving session. A held query is superseded by the client rebuild
//   on sign-in, or unmounted by requireAuth's redirect if sign-in fails.
export function decideAuthLoss(p: {
  authAttached: boolean
  authenticated: boolean
  waiting: boolean
}): AuthLossAction {
  if (p.authAttached) return 'redirect'
  if (p.authenticated || p.waiting) return 'hold'
  return 'redirect'
}

export function useAuthExchange() {
  const dispatch = redux.useDispatch()

  // Subscribe so the ref stays current; handleResult reads it
  // synchronously when a response lands. It can't take `waiting` as a
  // dependency without re-creating the exchange and tearing down
  // in-flight operations.
  const waiting = redux.useSelector(selectors.waiting)
  const waitingRef = React.useRef(waiting)
  waitingRef.current = waiting

  const authenticated = redux.useSelector(selectors.authenticated)
  const authenticatedRef = React.useRef(authenticated)
  authenticatedRef.current = authenticated

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
      // tell a racing/straggler unauthenticated request apart from a
      // genuinely rejected session. See decideAuthLoss.
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
      if (!r.error) return r

      const ctx: AuthContext = r.operation.context as any
      const handleInvalidToken =
        typeof ctx.auth === 'boolean'
          ? ctx.auth
          : R.defaultTo(ctx.auth?.handleInvalidToken, true)

      if (!handleInvalidToken || !isAuthLost(r.error)) return r

      const outcome = decideAuthLoss({
        authAttached: Boolean((r.operation.context as any).authAttached),
        authenticated: authenticatedRef.current,
        waiting: waitingRef.current,
      })

      if (outcome === 'redirect') {
        dispatch(actions.authLost(new InvalidToken({ originalError: r.error })))
      }
      // Both 'redirect' and 'hold' leave the operation unresolved: on redirect
      // so nothing renders before navigation; on hold so the racing/straggler
      // query is superseded by the post-sign-in client rebuild (or unmounted by
      // requireAuth's redirect if sign-in fails) rather than surfacing its 401.
      return new Promise<urql.OperationResult>(() => {})
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
