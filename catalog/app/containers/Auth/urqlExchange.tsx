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

// Error codes the registry sets in GraphQL error extensions when the
// caller's session can't be used. Treating these as "session lost" lets
// the catalog clear local tokens and redirect to /login instead of
// rendering a generic error banner (Vir incident 2026-04).
const AUTH_LOST_CODES = new Set(['AUTH_REFRESH_FAILED', 'NOT_LOGGED_IN'])

// Legacy registry replies that pre-date the typed error codes above.
// Match exactly to avoid swallowing unrelated errors.
const LEGACY_AUTH_LOST_MESSAGES = new Set([
  '[GraphQL] Token invalid.',
  '[GraphQL] Not logged in',
  '[GraphQL] Failed to refresh SSO access token',
])

export function isAuthLostError(error: urql.CombinedError): boolean {
  if (LEGACY_AUTH_LOST_MESSAGES.has(error.message)) return true
  return error.graphQLErrors.some((e) => {
    const code = (e.extensions as { code?: string } | undefined)?.code
    return code != null && AUTH_LOST_CODES.has(code)
  })
}

// True when every GraphQL error in the response carries the NOT_LOGGED_IN
// code — i.e. the request reached the registry with no Authorization
// header at all. This is the shape the post-OAuth-callback hydration
// race produces; AUTH_REFRESH_FAILED has a different shape and is not
// suppressed by this check.
export function isOnlyNotLoggedIn(error: urql.CombinedError): boolean {
  if (error.graphQLErrors.length === 0) return false
  return error.graphQLErrors.every(
    (e) => (e.extensions as { code?: string } | undefined)?.code === 'NOT_LOGGED_IN',
  )
}

const getFetchOptions = (op: urql.Operation) =>
  typeof op.context.fetchOptions === 'function'
    ? op.context.fetchOptions()
    : op.context.fetchOptions || {}

export function useAuthExchange() {
  const dispatch = redux.useDispatch()

  // Subscribe so the ref stays current; handleResult reads it
  // synchronously when a response lands.
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

      return urql.makeOperation(op.kind, op, {
        ...op.context,
        fetchOptions: {
          ...fetchOptions,
          headers: { ...fetchOptions.headers, ...authHeaders },
        },
      })
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

        if (handleInvalidToken && isAuthLostError(r.error)) {
          // Suppress NOT_LOGGED_IN while an auth handshake is in flight:
          // GraphQL queries from a freshly-mounted SPA can race the
          // post-OAuth-callback POST /api/login. Treating the racing 401
          // as "auth lost" would clear tokens and bounce the user back to
          // /login mid-handshake. AUTH_REFRESH_FAILED is never racy
          // (it implies a token was sent and rejected) so we still redirect.
          if (isOnlyNotLoggedIn(r.error) && waitingRef.current) {
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
