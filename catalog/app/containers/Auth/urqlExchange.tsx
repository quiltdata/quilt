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

// A registry 401 is auth-loss (missing, invalid, or refresh-failed credential):
// the status is the whole signal, the message is not load-bearing (403 is
// authenticated-but-forbidden, handled elsewhere).
export const isAuthLost = (error?: urql.CombinedError) => error?.response?.status === 401

// The full handleResult decision as a pure function: a result that isn't a
// handled 401 passes through untouched; otherwise defer to decideAuthLoss.
export function classifyAuthLoss(p: {
  handleInvalidToken: boolean | undefined
  is401: boolean
  authAttached: boolean
  authenticated: boolean
  waiting: boolean
}): 'passthrough' | AuthLossAction {
  if (!p.handleInvalidToken || !p.is401) return 'passthrough'
  return decideAuthLoss(p)
}

export function useAuthExchange() {
  const dispatch = redux.useDispatch()

  // Read fresh auth state synchronously when a response lands — the exchange
  // can't subscribe without tearing down in-flight operations (cf. PFSCookieManager).
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

      // Record whether we sent a credential — decideAuthLoss uses it to tell a
      // racing/straggler request from a genuinely rejected session.
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
      const state = store.getState()
      const outcome = classifyAuthLoss({
        handleInvalidToken:
          typeof ctx.auth === 'boolean'
            ? ctx.auth
            : R.defaultTo(ctx.auth?.handleInvalidToken, true),
        is401: isAuthLost(r.error),
        authAttached: Boolean(ctx.authAttached),
        authenticated: selectors.authenticated(state),
        waiting: selectors.waiting(state),
      })

      if (outcome === 'passthrough') return r
      if (outcome === 'redirect') {
        dispatch(actions.authLost(new InvalidToken({ originalError: r.error })))
      }
      // Leave the operation unresolved: on redirect so nothing renders before
      // navigation; on hold so the superseded query never surfaces its 401.
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
