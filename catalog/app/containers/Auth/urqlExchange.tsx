import * as R from 'ramda'
import * as React from 'react'
import * as redux from 'react-redux'
import * as urql from 'urql'
import * as W from 'wonka'

import defer from 'utils/defer'

import * as actions from './actions'
import { AuthLossAction, decideAuthLoss } from './authLoss'
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
  // set by transformOp: whether this operation carried a credential
  authAttached?: boolean
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

// Apply the auth-loss decision's side effect: 'redirect' dispatches authLost
// (clears the session and navigates to /login); 'hold' does nothing. Either
// way the caller leaves the operation unresolved.
export function applyAuthLoss(
  action: AuthLossAction,
  error: urql.CombinedError,
  dispatch: (action: unknown) => void,
): void {
  if (action === 'redirect') {
    dispatch(actions.authLost(new InvalidToken({ originalError: error })))
  }
}

export function useAuthExchange() {
  const dispatch = redux.useDispatch()

  // Read fresh auth state synchronously when a response lands (the codebase
  // idiom — cf. PFSCookieManager, Assistant). The exchange can't depend on
  // these selectors without tearing down in-flight operations on each change.
  const store = redux.useStore()

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

      const state = store.getState()
      applyAuthLoss(
        decideAuthLoss({
          authAttached: Boolean(ctx.authAttached),
          authenticated: selectors.authenticated(state),
          waiting: selectors.waiting(state),
        }),
        r.error,
        dispatch,
      )
      // Leave the operation unresolved either way: on redirect so nothing
      // renders before navigation; on hold so the superseded query never
      // surfaces its 401.
      return new Promise<urql.OperationResult>(() => {})
    },
    [dispatch, store],
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
