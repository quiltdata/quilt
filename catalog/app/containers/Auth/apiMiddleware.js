import { call, put } from 'redux-saga/effects';

import { HTTPError } from 'utils/APIConnector';

import { authLost } from './actions';
import { InvalidToken } from './errors';
import { getTokens } from './saga';


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
});

/**
 * @typedef {Object} AuthOptions
 *
 * @property {boolean|Object} tokens
 *   Auth tokens object to use, or `true` to take them from redux.
 *
 * @property {boolean} handleInvalidToken
 *   Whether to intercept 401 responses with 'Token invalid.' message and
 *   dispatch authentication lost action.
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
  const tokens = typeof auth === 'boolean' ? auth : (auth.tokens || true);
  const handleInvalidToken = typeof auth === 'boolean' ? auth : (auth.handleInvalidToken || true);

  const actualTokens = tokens === true
    ? yield call(getTokens)
    : (tokens || undefined);

  const authHeaders = actualTokens && makeHeadersFromTokens(actualTokens);

  const nextOpts = { ...opts, headers: { ...authHeaders, ...opts.headers } };

  try {
    return yield call(next, nextOpts);
  } catch (e) {
    if (
      handleInvalidToken
      && e instanceof HTTPError
      && e.status === 401
      && e.json && e.json.message === 'Token invalid.'
    ) {
      yield put(authLost(new InvalidToken({ originalError: e })));
    }
    throw e;
  }
}
