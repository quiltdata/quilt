import * as R from 'ramda'
import * as React from 'react'
import * as redux from 'react-redux'
import * as urql from 'urql'
import * as W from 'wonka'

import defer from 'utils/defer'

import * as actions from './actions'
import { InvalidToken } from './errors'

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

type Dispatch = ReturnType<typeof redux.useDispatch>

function makeAuthExchange(dispatch: Dispatch) {
  console.log('makeAuthExchange')
  const getTokens = () => {
    const { resolver, promise } = defer<AuthTokens>()
    dispatch(actions.getTokens(resolver))
    return promise
  }

  const transformOp = async (op: urql.Operation) => {
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
  }

  const handleResult = async (r: urql.OperationResult) => {
    if (r.error) {
      const ctx: AuthContext = r.operation.context as any

      const handleInvalidToken =
        typeof ctx.auth === 'boolean'
          ? ctx.auth
          : R.defaultTo(ctx.auth?.handleInvalidToken, true)

      if (handleInvalidToken && r.error.message === '[GraphQL] Token invalid.') {
        dispatch(actions.authLost(new InvalidToken({ originalError: r.error })))
        // never resolve on auth error
        return new Promise<urql.OperationResult>(() => {})
      }
    }
    return r
  }

  return ({ forward }: urql.ExchangeInput): urql.ExchangeIO =>
    (ops$) =>
      W.pipe(
        ops$,
        W.mergeMap((op) => W.fromPromise(transformOp(op))),
        forward,
        W.mergeMap((result) => W.fromPromise(handleResult(result))),
      )
}

export function useAuthExchange(sessionId?: number) {
  const dispatch = redux.useDispatch()

  return React.useMemo(() => makeAuthExchange(dispatch), [dispatch, sessionId])
}
