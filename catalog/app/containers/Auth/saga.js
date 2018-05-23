/**
 * Sagas and stuff for Auth
 */

import { call, put, select, fork, takeEvery } from 'redux-saga/effects';

import defer from 'utils/defer';
import { waitTil } from 'utils/sagaTools';
import { timestamp } from 'utils/time';

import { signIn, refresh, check } from './actions';
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
 * @returns {object}
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
 * Store tokens, then fetch user data and store it as well.
 * Dispatch SIGN_IN_SUCCESS if everything's ok.
 *
 * @param {object} options
 * @param {function} options.storeTokens
 * @param {function} options.storeUser
 * @param {function} options.forgetTokens
 * @param {object} action
 */
function* handleSignIn(
  { storeTokens, storeUser, forgetTokens },
  { payload: tokens, meta: { resolve, reject } },
) {
  try {
    // TODO
    yield fork(storeTokens, tokens);
    const user = yield call(requests.fetchUser, tokens);
    yield fork(storeUser, user);
    yield put(signIn.success(user));
    /* istanbul ignore else */
    if (resolve) yield call(resolve, user);
  } catch (e) {
    //if (e instanceof HttpError && e.status === 401) {
      //yield fork(forgetTokens);
    //}
    yield put(signIn.error(e));
    // TODO: throw?
    /* istanbul ignore else */
    if (reject) yield call(reject, e);
  }
}

/**
 * Handle SIGN_OUT action.
 *
 * @param {object} options
 * @param {function} options.forgetTokens
 * @param {function} options.forgetUser
 * @param {object} action
 */
function* handleSignOut({ forgetTokens, forgetUser }, { meta: { resolve } }) {
  try {
    console.log('handle signout');
    //const token = yield select(TODO);
    // TODO: make sure to await the result
    yield call(requests.signOut, token);
    yield fork(forgetUser);
    yield fork(forgetTokens);
    /* istanbul ignore else */
    if (resolve) yield call(resolve);
  } catch (e) {
    console.log('handle signout: error', e);
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
 * @param {object} options
 * @param {function} options.storeTokens
 * @param {function} options.storeUser
 * @param {function} options.forgetTokens
 * @param {function} options.forgetUser
 * @param {function} options.onAuthLost
 * @param {function} options.onAuthError
 * @param {object} action
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
 * @param {object} options
 * @param {function} options.onAuthLost
 * @param {object} action
 */
function* handleAuthLost({ onAuthLost }, { payload: err }) {
  yield call(onAuthLost, err);
}

const noop = () => {};

/**
 * Main Auth saga.
 * Handles auth actions and fires CHECK action on specified condition.
 *
 * @param {object} options
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
