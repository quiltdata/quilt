/**
 * Sagas and stuff for Auth
 */

import { call, put, select, fork, takeEvery } from 'redux-saga/effects';

import defer from 'utils/defer';
import { waitTil } from 'utils/sagaTools';
import { timestamp } from 'utils/time';

import { signIn, signOut, refresh, check } from './actions';
import { actions } from './constants';
import { AuthError, NotAuthenticated } from './errors';
import * as requests from './requests';
import * as selectors from './selectors';
import { makeHeadersFromTokens } from './util';


/**
 * Make auth headers from stored auth data,
 * checking if auth token is up-to-date and
 * waiting til the auth requests are settled if they are in progress.
 *
 * @returns {Object}
 *   Object containing the auth headers, empty if not authenticated.
 */
export function* makeHeaders() {
  const checked = defer();
  yield put(check({ refetch: false }, checked.resolver));
  yield checked.promise;
  yield call(waitTil, selectors.waiting, (w) => !w);

  const authenticated = yield select(selectors.authenticated);
  if (!authenticated) return {};

  const tokens = yield select(selectors.tokens);
  return makeHeadersFromTokens(tokens);
}

/**
 * Handle SIGN_UP action.
 * Make a sign-up request and call resolve or reject callback with the result.
 *
 * @param {Action} action
 */
function* handleSignUp({ payload: credentials, meta: { resolve, reject } }) {
  try {
    const res = yield call(requests.signUp, credentials);
    console.log('handle sign up res', res);
    yield call(resolve);
  } catch(e) {
    yield call(reject, e);
  }
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
    console.log('handleSignIn', { credentials });
    const tokens = yield call(requests.signIn, credentials);
    console.log('handleSignIn: tokens', { tokens });
    const user = yield call(requests.fetchUser, tokens);
    console.log('handleSignIn: user', { user });
    yield fork(storeTokens, tokens);
    yield fork(storeUser, user);
    yield put(signIn.resolve({ tokens, user }));
    /* istanbul ignore else */
    if (resolve) yield call(resolve, { tokens, user });
  } catch (e) {
    console.log('handleSignIn: error', e);
    //if (e instanceof HttpError && e.status === 401) {
      //yield fork(forgetTokens);
    //}
    yield put(signIn.resolve(e));
    // TODO: throw?
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
    console.log('handle signout');
    const { token } = yield select(selectors.tokens);
    // TODO: make sure to await the result
    const res = yield call(requests.signOut, token);
    console.log('handle signout: result', res);
    yield fork(forgetUser);
    yield fork(forgetTokens);
    /* istanbul ignore else */
    yield put(signOut.resolve());
    if (resolve) yield call(resolve);
  } catch (e) {
    console.log('handle signout: error', e);
    yield put(signOut.resolve(e));
    if (reject) yield call(reject, e);
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
 * @param {Action} action
 */
function* handleCheck(
  { storeTokens, storeUser, forgetTokens, forgetUser, onAuthLost, onAuthError },
  { payload: { refetch }, meta: { resolve } },
) {
  try {
    const tokens = yield select(selectors.tokens);
    const time = yield call(timestamp);
    if (!tokens.refresh_token || !isExpired(tokens, time)) {
      if (resolve) yield call(resolve);
      return;
    }

    yield put(refresh());
    const newTokens = yield call(requests.refreshTokens, tokens.refresh_token);
    yield fork(storeTokens, newTokens);
    let user;
    if (refetch) {
      user = yield call(requests.fetchUser, newTokens);
      yield fork(storeUser, user);
    }
    yield put(refresh.success(newTokens, user));
    if (resolve) yield call(resolve);
  } catch (e) {
    yield put(refresh.error(e));
    if (e instanceof NotAuthenticated) {
      yield fork(forgetTokens);
      yield fork(forgetUser);
      yield call(onAuthLost, e);
    } else {
      yield call(onAuthError, e);
    }
    if (resolve) yield call(resolve);
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
  yield takeEvery(actions.SIGN_UP, handleSignUp);
  yield takeEvery(actions.SIGN_IN, handleSignIn, { storeTokens, storeUser, forgetTokens });
  yield takeEvery(actions.SIGN_OUT, handleSignOut, { forgetTokens, forgetUser });
  //yield takeEvery(actions.CHECK, handleCheck, { storeTokens, storeUser, forgetTokens, forgetUser, onAuthLost, onAuthError });
  //yield takeEvery(actions.AUTH_LOST, handleAuthLost, { onAuthLost });

  //if (checkOn) yield takeEvery(checkOn, function* checkAuth() { yield put(check()); });
}
