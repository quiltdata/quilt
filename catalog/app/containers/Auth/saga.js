import { call, put, select, fork, takeEvery } from 'redux-saga/effects';

import defer from 'utils/defer';
import { requestJSON, HttpError } from 'utils/request';
import { waitTil } from 'utils/sagaTools';
import { timestamp } from 'utils/time';

import * as actions from './actions';
import * as errors from './errors';
import * as selectors from './selectors';

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
 * Make auth headers from stored auth data,
 * checking if auth token is up-to-date and
 * waiting until any pending auth requests are settled.
 *
 * @returns {Object}
 *   Object containing the auth headers, empty if not authenticated.
 */
export function* makeHeaders() {
  const checked = defer();
  yield put(actions.check({ refetch: false }, checked.resolver));
  // eslint-disable-next-line no-empty
  try { yield checked.promise; } catch (e) {}
  yield call(waitTil, selectors.waiting, (w) => !w);

  const authenticated = yield select(selectors.authenticated);
  if (!authenticated) return {};

  const tokens = yield select(selectors.tokens);
  return makeHeadersFromTokens(tokens);
}

export const adjustTokensForLatency = (tokens, latency) => ({
  ...tokens,
  exp:
    Number.isFinite(tokens.exp)
      ? tokens.exp - latency
      /* istanbul ignore next */
      : tokens.exp,
});
/**
 * Make a sign-up request.
 *
 * @param {string} api The API URL.
 *
 * @param {Object} credentials
 *
 * @throws {InvalidUsername}
 * @throws {InvalidEmail}
 * @throws {InvalidPassword}
 * @throws {UsernameTaken}
 * @throws {EmailTaken}
 * @throws {AuthError}
 */
const signUp = async (api, credentials) => {
  try {
    await requestJSON(`${api}/register`, {
      method: 'POST',
      body: JSON.stringify(credentials),
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (e) {
    /* istanbul ignore else */
    if (e instanceof HttpError) {
      if (e.status === 400 && e.json && e.json.error === 'Unacceptable username.') {
        throw new errors.InvalidUsername({ originalError: e });
      }
      if (e.status === 400 && e.json && e.json.error === 'Unacceptable email.') {
        throw new errors.InvalidEmail({ originalError: e });
      }
      if (e.status === 400 && e.json && e.json.error.match(/Password must be/)) {
        throw new errors.InvalidPassword({ originalError: e });
      }
      if (e.status === 409 && e.json && e.json.error === 'Username already taken.') {
        throw new errors.UsernameTaken({ originalError: e });
      }
      if (e.status === 409 && e.json && e.json.error === 'Email already taken.') {
        throw new errors.EmailTaken({ originalError: e });
      }
    }
    throw new errors.AuthError({
      message: 'unable to sign up',
      originalError: e,
    });
  }
};

/**
 * Make a sign-out request (revoke the token).
 *
 * @param {string} api The API URL.
 *
 * @param {string} token
 *
 * @throws {AuthError}
 */
const signOut = async (api, tokens) => {
  try {
    await requestJSON(`${api}/logout`, {
      method: 'POST',
      body: JSON.stringify({ token: tokens.token }),
      headers: {
        ...makeHeadersFromTokens(tokens),
        'Content-Type': 'application/json',
      },
    });
  } catch (e) {
    throw new errors.AuthError({
      message: 'unable to sign out',
      originalError: e,
    });
  }
};

/**
 * Make a sign-in request.
 *
 * @param {string} api The API URL.
 *
 * @param {Object} credentials
 * @param {string} credentials.username
 * @param {string} credentials.password
 *
 * @throws {InvalidCredentials}
 * @throws {AuthError}
 */
const signIn = async (api, credentials) => {
  try {
    const res = await requestJSON(`${api}/login`, {
      method: 'POST',
      body: JSON.stringify(credentials),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (res.error) {
      /* istanbul ignore else */
      if (res.error === 'Login attempt failed') {
        throw new errors.InvalidCredentials();
      }
      /* istanbul ignore next */
      throw new Error(res.error);
    }

    return res;
  } catch (e) {
    if (e instanceof errors.AuthError) throw e;
    throw new errors.AuthError({
      message: 'unable to sign in',
      originalError: e,
    });
  }
};

/**
 * Fetch user data.
 *
 * @param {string} api The API URL.
 *
 * @param {Object} tokens
 *
 * @returns {Object} User data.
 *
 * @throws {NotAuthenticated} The API responds w/ 401.
 * @throws {AuthError}
 *   Wrap any caught error into AuthError,
 *   with original error attached as `originalError` property.
 */
const fetchUser = async (api, tokens) => {
  try {
    const auth = await requestJSON(`${api}/api-root`, {
      headers: makeHeadersFromTokens(tokens),
    });
    return auth;
  } catch (e) {
    if (e instanceof HttpError && e.status === 401) {
      throw new errors.NotAuthenticated({ originalError: e });
    }

    throw new errors.AuthError({
      message: 'unable to fetch user data',
      originalError: e,
    });
  }
};

/**
 * Make a password reset request.
 *
 * @param {string} api The API URL.
 *
 * @param {string} email
 *
 * @throws {AuthError}
 */
const resetPassword = async (api, email) => {
  try {
    await requestJSON(`${api}/reset_password`, {
      method: 'POST',
      body: JSON.stringify({ email }),
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (e) {
    throw new errors.AuthError({
      message: 'unable to reset password',
      originalError: e,
    });
  }
};

/**
 * Make a password change request.
 *
 * @param {string} api The API URL.
 *
 * @param {string} link
 * @param {string} password
 *
 * @throws {AuthError}
 * @throws {InvalidResetLink}
 * @throws {InvalidPassword}
 */
const changePassword = async (api, link, password) => {
  try {
    await requestJSON(`${api}/reset_password`, {
      method: 'POST',
      body: JSON.stringify({ link, password }),
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (e) {
    /* istanbul ignore else */
    if (e instanceof HttpError) {
      if (e.status === 404 && e.json && e.json.error === 'User not found.') {
        throw new errors.InvalidResetLink({ originalError: e });
      }
      if (e.status === 400 && e.json && e.json.error === 'Invalid link.') {
        throw new errors.InvalidResetLink({ originalError: e });
      }
      if (e.status === 400 && e.json && e.json.error.match(/Password must be/)) {
        throw new errors.InvalidPassword({ originalError: e });
      }
    }

    throw new errors.AuthError({
      message: 'unable to change password',
      originalError: e,
    });
  }
};

/**
 * Get the code from the API.
 *
 * @param {string} api The API URL.
 *
 * @param {Object} tokens
 *
 * @returns {string} The code.
 *
 * @throws {AuthError}
 */
const getCode = async (api, tokens) => {
  try {
    const { code } = await requestJSON(`${api}/api/code`, {
      headers: makeHeadersFromTokens(tokens),
    });
    return code;
  } catch (e) {
    throw new errors.AuthError({
      message: 'unable to get the code',
      originalError: e,
    });
  }
};

/**
 * Refresh auth tokens.
 *
 * @param {string} api The API URL.
 *
 * @param {number} latency
 *
 * @param {Object} tokens
 *
 * @returns {Object} Refreshed tokens adjusted for latency.
 *
 * @throws {NotAuthenticated}
 * @throws {AuthError}
 */
const refreshTokens = async (api, latency, tokens) => {
  try {
    const newTokens = await requestJSON(`${api}/api/refresh`, {
      method: 'POST',
      headers: makeHeadersFromTokens(tokens),
    });
    return adjustTokensForLatency(newTokens, latency);
  } catch (e) {
    if (e instanceof HttpError && e.status === 401) {
      throw new errors.NotAuthenticated({ originalError: e });
    }
    throw new errors.AuthError({
      message: 'unable to refresh tokens',
      originalError: e,
    });
  }
};

/**
 * Handle SIGN_IN action.
 * Make a sign-in request using the given credentials,
 * then request the user data using received tokens.
 * Finally, store the tokens and user data and dispatch a SIGN_IN_RESULT action.
 * Call resolve or reject callback.
 *
 * @param {Object} options
 * @param {string} options.api
 * @param {number} options.latency
 * @param {function} options.storeTokens
 * @param {function} options.storeUser
 *
 * @param {Action} action
 */
function* handleSignIn(
  { api, latency, storeTokens, storeUser },
  { payload: credentials, meta: { resolve, reject } },
) {
  try {
    const tokensRaw = yield call(signIn, api, credentials);
    const tokens = adjustTokensForLatency(tokensRaw, latency);
    const user = yield call(fetchUser, api, tokens);
    yield fork(storeTokens, tokens);
    yield fork(storeUser, user);
    yield put(actions.signIn.resolve({ tokens, user }));
    /* istanbul ignore else */
    if (resolve) yield call(resolve, { tokens, user });
  } catch (e) {
    yield put(actions.signIn.resolve(e));
    /* istanbul ignore else */
    if (reject) yield call(reject, e);
  }
}

/**
 * Handle SIGN_OUT action.
 *
 * @param {Object} options
 * @param {string} options.api
 * @param {function} options.forgetTokens
 * @param {function} options.forgetUser
 *
 * @param {Action} action
 */
function* handleSignOut({ api, forgetTokens, forgetUser }, { meta: { resolve, reject } }) {
  try {
    const tokens = yield select(selectors.tokens);
    yield call(signOut, api, tokens);
    yield put(actions.signOut.resolve());
    /* istanbul ignore else */
    if (resolve) yield call(resolve);
  } catch (e) {
    yield put(actions.signOut.resolve(e));
    /* istanbul ignore else */
    if (reject) yield call(reject, e);
  } finally {
    yield fork(forgetUser);
    yield fork(forgetTokens);
  }
}

const isExpired = (tokens, time) => {
  // some backwards compatibility
  const exp = tokens.exp || tokens.expires_at || tokens.expires_on;
  return exp && exp < time;
};

/**
 * Handle CHECK action.
 * Check if the stored tokens are up-to-date.
 * Refresh tokens if stale, store the refreshed ones.
 * Then refetch and store user data if requested.
 *
 * @param {Object} options
 * @param {string} options.api
 * @param {number} options.latency
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
  { api, latency, storeTokens, storeUser, forgetTokens, forgetUser, onAuthLost, onAuthError },
  { payload: { refetch }, meta: { resolve, reject } },
) {
  try {
    const tokens = yield select(selectors.tokens);
    const time = yield call(timestamp);
    if (!isExpired(tokens, time)) {
      /* istanbul ignore else */
      if (resolve) yield call(resolve);
      return;
    }

    yield put(actions.refresh());
    const newTokens = yield call(refreshTokens, api, latency, tokens);
    yield fork(storeTokens, newTokens);
    let user;
    if (refetch) {
      user = yield call(fetchUser, api, newTokens);
      yield fork(storeUser, user);
    }
    const payload = { tokens: newTokens, user };
    yield put(actions.refresh.resolve(payload));
    /* istanbul ignore else */
    if (resolve) yield call(resolve, payload);
  } catch (e) {
    yield put(actions.refresh.resolve(e));
    if (e instanceof errors.NotAuthenticated) {
      yield fork(forgetTokens);
      yield fork(forgetUser);
      yield call(onAuthLost, e);
    } else {
      yield call(onAuthError, e);
    }
    /* istanbul ignore else */
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

/**
 * Handle SIGN_UP action.
 *
 * @param {Object} options
 * @param {string} optiosn.api
 * @param {Action} action
 */
function* handleSignUp({ api }, { payload: credentials, meta: { resolve, reject } }) {
  try {
    yield call(signUp, api, credentials);
    yield call(resolve);
  } catch (e) {
    yield call(reject, e);
  }
}

/**
 * Handle RESET_PASSWORD action.
 *
 * @param {Object} options
 * @param {string} options.api
 * @param {Action} action
 */
function* handleResetPassword({ api }, { payload: email, meta: { resolve, reject } }) {
  try {
    yield call(resetPassword, api, email);
    yield call(resolve);
  } catch (e) {
    yield call(reject, e);
  }
}

/**
 * Handle CHANGE_PASSWORD action.
 *
 * @param {Object} options
 * @param {string} options.api
 * @param {Action} action
 */
function* handleChangePassword({ api }, { payload: { link, password }, meta: { resolve, reject } }) {
  try {
    yield call(changePassword, api, link, password);
    yield call(resolve);
  } catch (e) {
    yield call(reject, e);
  }
}

/**
 * Handle GET_CODE action.
 *
 * @param {Object} options
 * @param {string} options.api
 * @param {Action} action
 */
function* handleGetCode({ api }, { meta: { resolve, reject } }) {
  try {
    const tokens = yield select(selectors.tokens);
    const code = yield call(getCode, api, tokens);
    yield call(resolve, code);
  } catch (e) {
    yield call(reject, e);
  }
}

/**
 * Main Auth saga.
 * Handles auth actions and fires CHECK action on specified condition.
 *
 * @param {Object} options
 * @param {string} options.api
 * @param {function} options.checkOn
 * @param {function} options.storeTokens
 * @param {function} options.forgetTokens
 * @param {function} options.storeUser
 * @param {function} options.forgetUser
 * @param {function} options.onAuthLost
 * @param {function} options.onAuthError
 */
export default function* ({
  api,
  latency,
  checkOn,
  storeTokens,
  forgetTokens,
  storeUser,
  forgetUser,
  onAuthLost,
  onAuthError,
}) {
  yield takeEvery(actions.signIn.type, handleSignIn,
    { api, latency, storeTokens, storeUser, forgetTokens });
  yield takeEvery(actions.signOut.type, handleSignOut, { api, forgetTokens, forgetUser });
  yield takeEvery(actions.check.type, handleCheck,
    // eslint-disable-next-line object-curly-newline
    { api, latency, storeTokens, storeUser, forgetTokens, forgetUser, onAuthLost, onAuthError });
  yield takeEvery(actions.authLost.type, handleAuthLost, { onAuthLost });
  yield takeEvery(actions.signUp.type, handleSignUp, { api });
  yield takeEvery(actions.resetPassword.type, handleResetPassword, { api });
  yield takeEvery(actions.changePassword.type, handleChangePassword, { api });
  yield takeEvery(actions.getCode.type, handleGetCode, { api });

  /* istanbul ignore else */
  if (checkOn) yield takeEvery(checkOn, function* checkAuth() { yield put(actions.check()); });
}
