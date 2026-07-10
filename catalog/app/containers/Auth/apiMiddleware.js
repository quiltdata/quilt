import defaultTo from 'lodash/defaultTo'
import { call, put, select } from 'redux-saga/effects'

import { HTTPError } from 'utils/APIConnector'

import { authLost } from './actions'
import { decideAuthLoss } from './authLoss'
import { InvalidToken } from './errors'
import { getTokens } from './saga'
import * as selectors from './selectors'

/**
 * Make auth headers from given auth token.
 *
 * @param {Object} tokens
 * @param {string} tokens.token
 *
 * @returns {Object} Auth headers.
 */
const makeHeadersFromTokens = ({ token }) => ({
  Authorization: `Bearer ${token}`,
})

/**
 * @typedef {Object} AuthOptions
 *
 * @property {boolean|Object} tokens
 *   Auth tokens object to use, or `true` to take them from redux.
 *
 * @property {boolean} handleInvalidToken
 *   Whether to intercept 401 (auth-lost) responses and dispatch the
 *   authentication-lost action. The registry returns 401 for any
 *   unauthenticatable request — missing, invalid, or refresh-failed
 *   credential — so the status alone is the signal.
 */

/**
 * Auth middleware for APIConnector. Adds auth headers to the request and
 * intercept errors caused by invalid auth token.
 *
 * @type {APIConnector.Middleware}
 *
 * @param {Object} options
 *
 * @param {boolean|AuthOptions} options.auth
 */
export default function* authMiddleware({ auth = true, ...opts }, next) {
  const tokens = typeof auth === 'boolean' ? auth : defaultTo(auth.tokens, true)

  const handleInvalidToken =
    typeof auth === 'boolean' ? auth : defaultTo(auth.handleInvalidToken, true)

  const actualTokens = tokens === true ? yield call(getTokens) : tokens || undefined

  const authHeaders = actualTokens && makeHeadersFromTokens(actualTokens)

  const nextOpts = { ...opts, headers: { ...authHeaders, ...opts.headers } }

  try {
    return yield call(next, nextOpts)
  } catch (e) {
    // Same auth-loss policy as the GraphQL exchange (decideAuthLoss): only
    // redirect on a genuinely dead/absent session, never on a no-credential
    // 401 that raced or preceded an arriving session.
    if (handleInvalidToken && HTTPError.is(e, 401)) {
      const authenticated = yield select(selectors.authenticated)
      const waiting = yield select(selectors.waiting)
      const action = decideAuthLoss({
        authAttached: !!authHeaders,
        authenticated,
        waiting,
      })
      if (action === 'redirect') {
        yield put(authLost(new InvalidToken({ originalError: e })))
      }
    }
    throw e
  }
}
