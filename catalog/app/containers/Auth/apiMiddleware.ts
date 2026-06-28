import defaultTo from 'lodash/defaultTo'
import { call, put } from 'redux-saga/effects'

import { HTTPError } from 'utils/APIConnector'

import { authLost } from './actions'
import { InvalidToken } from './errors'
import { getTokens } from './saga'

interface Tokens {
  token?: string
  [k: string]: any
}

/**
 * Make auth headers from given auth token.
 */
const makeHeadersFromTokens = ({ token }: Tokens) => ({
  Authorization: `Bearer ${token}`,
})

interface AuthOptions {
  /**
   * Auth tokens object to use, or `true` to take them from redux.
   */
  tokens?: boolean | Tokens

  /**
   * Whether to intercept 401 responses with 'Token invalid.' message and
   * dispatch authentication lost action.
   */
  handleInvalidToken?: boolean
}

interface AuthMiddlewareOptions {
  auth?: boolean | AuthOptions
  [k: string]: any
}

/**
 * Auth middleware for APIConnector. Adds auth headers to the request and
 * intercept errors caused by invalid auth token.
 */
export default function* authMiddleware(
  { auth = true, ...opts }: AuthMiddlewareOptions,
  next: any,
): Generator<any, any, any> {
  const tokens = typeof auth === 'boolean' ? auth : defaultTo(auth.tokens, true)

  const handleInvalidToken =
    typeof auth === 'boolean' ? auth : defaultTo(auth.handleInvalidToken, true)

  const actualTokens = tokens === true ? yield call(getTokens) : tokens || undefined

  const authHeaders = actualTokens && makeHeadersFromTokens(actualTokens)

  const nextOpts = { ...opts, headers: { ...authHeaders, ...opts.headers } }

  try {
    return yield call(next, nextOpts)
  } catch (e) {
    if (handleInvalidToken && HTTPError.is(e, 401, 'Token invalid.')) {
      yield put(authLost(new InvalidToken({ originalError: e })))
    }
    throw e
  }
}
