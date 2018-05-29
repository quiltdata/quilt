import { call, put, select, fork, takeEvery } from 'redux-saga/effects';

import defer from 'utils/defer';
import { waitTil } from 'utils/sagaTools';
import { timestamp } from 'utils/time';

import { signIn, signOut, refresh, check } from './actions';
import { actions } from './constants';
import { NotAuthenticated } from './errors';
import * as requests from './requests';
import * as selectors from './selectors';
import { makeHeadersFromTokens } from './util';


/**
 * Make auth headers from stored auth data,
 * checking if auth token is up-to-date and
 * waiting until any pending auth requests are settled.
 *
 * @returns {Object}
 *   Object containing the auth headers, empty if not authenticated.
 */
export function* makeHeaders() {
  const checked = defer();
  yield put(check({ refetch: false }, checked.resolver));
  // eslint-disable-next-line no-empty
  try { yield checked.promise; } catch (e) {}
  yield call(waitTil, selectors.waiting, (w) => !w);

  const authenticated = yield select(selectors.authenticated);
  if (!authenticated) return {};

  const tokens = yield select(selectors.tokens);
  return makeHeadersFromTokens(tokens);
}

/**
 * Handle SIGN_IN action.
 * Make a sign-in request using the given credentials,
 * then request the user data using received tokens.
 * Finally, store the tokens and user data and dispatch a SIGN_IN_RESULT action.
 * Call resolve or reject callback.
 *
 * @param {Object} options
 * @param {function} options.storeTokens
 * @param {function} options.storeUser
 *
 * @param {Action} action
 */
function* handleSignIn(
  { storeTokens, storeUser },
  { payload: credentials, meta: { resolve, reject } },
) {
  try {
    const tokens = yield call(requests.signIn, credentials);
    const user = yield call(requests.fetchUser, tokens);
    yield fork(storeTokens, tokens);
    yield fork(storeUser, user);
    yield put(signIn.resolve({ tokens, user }));
    /* istanbul ignore else */
    if (resolve) yield call(resolve, { tokens, user });
  } catch (e) {
    yield put(signIn.resolve(e));
    /* istanbul ignore else */
    if (reject) yield call(reject, e);
  }
}

/**
 * Handle SIGN_OUT action.
 *
 * @param {Object} options
 * @param {function} options.forgetTokens
 * @param {function} options.forgetUser
 *
 * @param {Action} action
 */
function* handleSignOut({ forgetTokens, forgetUser }, { meta: { resolve, reject } }) {
  try {
    const tokens = yield select(selectors.tokens);
    yield call(requests.signOut, tokens);
    yield put(signOut.resolve());
    /* istanbul ignore else */
    if (resolve) yield call(resolve);
  } catch (e) {
    yield put(signOut.resolve(e));
    if (reject) yield call(reject, e);
  } finally {
    yield fork(forgetUser);
    yield fork(forgetTokens);
  }
}

const isExpired = (tokens, time) => {
  // "expires_at" used to be "expires_on"
  const expiresAt = tokens.expires_at || /* istanbul ignore next */ tokens.expires_on;
  return expiresAt && expiresAt < time;
};

/**
 * Handle CHECK action.
 * Check if the stored tokens are up-to-date.
 * Refresh tokens if stale, store the refreshed ones.
 * Then refetch and store user data if requested.
 *
 * @param {Object} options
 * @param {function} options.storeTokens
 * @param {function} options.storeUser
 * @param {function} options.forgetTokens
 * @param {function} options.forgetUser
 * @param {function} options.onAuthLost
 * @param {function} options.onAuthError
 *
 * @param {Action} action
 */
function* handleCheck(
  // eslint-disable-next-line object-curly-newline
  { storeTokens, storeUser, forgetTokens, forgetUser, onAuthLost, onAuthError },
  { payload: { refetch }, meta: { resolve, reject } },
) {
  try {
    const tokens = yield select(selectors.tokens);
    const time = yield call(timestamp);
    if (!isExpired(tokens, time)) {
      if (resolve) yield call(resolve);
      return;
    }

    yield put(refresh());
    const newTokens = yield call(requests.refreshTokens, tokens);
    yield fork(storeTokens, newTokens);
    let user;
    if (refetch) {
      user = yield call(requests.fetchUser, newTokens);
      yield fork(storeUser, user);
    }
    const payload = { tokens: newTokens, user };
    yield put(refresh.resolve(payload));
    if (resolve) yield call(resolve, payload);
  } catch (e) {
    yield put(refresh.resolve(e));
    if (e instanceof NotAuthenticated) {
      yield fork(forgetTokens);
      yield fork(forgetUser);
      yield call(onAuthLost, e);
    } else {
      yield call(onAuthError, e);
    }
    if (reject) yield call(reject, e);
  }
}

/**
 * Handle AUTH_LOST action.
 *
 * @param {Object} options
 * @param {function} options.onAuthLost
 * @param {Action} action
 */
function* handleAuthLost({ onAuthLost }, { payload: err }) {
  yield call(onAuthLost, err);
}

const noop = () => {};

/**
 * Main Auth saga.
 * Handles auth actions and fires CHECK action on specified condition.
 *
 * @param {Object} options
 * @param {function} options.checkOn
 * @param {function} options.storeTokens
 * @param {function} options.forgetTokens
 * @param {function} options.storeUser
 * @param {function} options.forgetUser
 * @param {function} options.onAuthLost
 * @param {function} options.onAuthError
 */
export default function* (/* istanbul ignore next */ {
  checkOn,
  storeTokens = noop,
  forgetTokens = noop,
  storeUser = noop,
  forgetUser = noop,
  onAuthLost = noop,
  onAuthError = noop,
} = {}) {
  yield takeEvery(actions.SIGN_IN, handleSignIn, { storeTokens, storeUser, forgetTokens });
  yield takeEvery(actions.SIGN_OUT, handleSignOut, { forgetTokens, forgetUser });
  yield takeEvery(actions.CHECK, handleCheck,
    // eslint-disable-next-line object-curly-newline
    { storeTokens, storeUser, forgetTokens, forgetUser, onAuthLost, onAuthError });
  yield takeEvery(actions.AUTH_LOST, handleAuthLost, { onAuthLost });

  if (checkOn) yield takeEvery(checkOn, function* checkAuth() { yield put(check()); });
}
