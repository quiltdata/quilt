// @flow

import { call, put, select, fork, takeEvery } from 'redux-saga/effects';
import type { Pattern, Saga } from 'redux-saga';

import { apiRequest, HTTPError } from 'utils/APIConnector';
import defer from 'utils/defer';
import { waitTil } from 'utils/sagaTools';
import { timestamp } from 'utils/time';

import * as actions from './actions';
import * as errors from './errors';
import * as selectors from './selectors';
import type { Tokens, User } from './types';


export const adjustTokensForLatency = (tokens: Tokens, latency: number) => ({
  ...tokens,
  exp:
    tokens.exp && Number.isFinite(tokens.exp)
      ? tokens.exp - latency
      /* istanbul ignore next */
      : tokens.exp,
});

/**
 * Get auth tokens from stored auth data, checking if auth token is up-to-date
 * and waiting until any pending auth requests are settled.
 * Returns an object with the auth tokens, undefined if not authenticated.
 */
export function* getTokens(): Saga<?Tokens> {
  const checked = defer();
  yield put(actions.check({ refetch: false }, checked.resolver));
  // eslint-disable-next-line no-empty
  try { yield checked.promise; } catch (e) {}
  yield call(waitTil, selectors.waiting, (w) => !w);
  return yield select(selectors.tokens);
}

/**
 * Make a sign-up request.
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
function* signUp(credentials: actions.SignUpCredentials): Saga<void> {
  try {
    yield call(apiRequest, {
      auth: false,
      endpoint: '/register',
      method: 'POST',
      body: credentials,
    });
  } catch (e) {
    /* istanbul ignore else */
    if (e instanceof HTTPError) {
      if (e.status === 400 && e.json && e.json.message === 'Invalid username.') {
        throw new errors.InvalidUsername({ originalError: e });
      }
      if (e.status === 400 && e.json && e.json.message === 'Invalid email.') {
        throw new errors.InvalidEmail({ originalError: e });
      }
      if (e.status === 400 && e.json && e.json.message.match(/Password must be/)) {
        throw new errors.InvalidPassword({ originalError: e });
      }
      if (e.status === 409 && e.json && e.json.message === 'Username already taken.') {
        throw new errors.UsernameTaken({ originalError: e });
      }
      if (e.status === 409 && e.json && e.json.message === 'Email already taken.') {
        throw new errors.EmailTaken({ originalError: e });
      }
    }
    throw new errors.AuthError({
      message: 'unable to sign up',
      originalError: e,
    });
  }
}

/**
 * Make a sign-out request (revoke the token).
 *
 * @throws {AuthError}
 */
function* signOut(): Saga<void> {
  try {
    yield call(apiRequest, {
      auth: { handleInvalidToken: false },
      endpoint: '/logout',
      method: 'POST',
    });
  } catch (e) {
    throw new errors.AuthError({
      message: 'unable to sign out',
      originalError: e,
    });
  }
}

/**
 * Make a sign-in request.
 *
 * @throws {InvalidCredentials}
 * @throws {AuthError}
 */
function* signIn(credentials: actions.SignInCredentials): Saga<Tokens> {
  try {
    const { token, exp } = yield call(apiRequest, {
      auth: false,
      endpoint: '/login',
      method: 'POST',
      body: credentials,
    });
    return { token, exp };
  } catch (e) {
    if (e instanceof HTTPError && e.status === 401) {
      throw new errors.InvalidCredentials();
    }

    throw new errors.AuthError({
      message: 'unable to sign in',
      originalError: e,
    });
  }
}

/**
 * Fetch user data.
 *
 * @throws {InvalidToken} The auth token is invalid.
 * @throws {AuthError}
 *   Wrap any caught error into AuthError,
 *   with original error attached as `originalError` property.
 */
function* fetchUser(tokens: Tokens): Saga<User> {
  try {
    const auth = yield call(apiRequest, {
      auth: { tokens, handleInvalidToken: false },
      endpoint: '/me',
    });
    return auth;
  } catch (e) {
    if (e instanceof HTTPError && e.status === 401) {
      throw new errors.InvalidToken({ originalError: e });
    }

    throw new errors.AuthError({
      message: 'unable to fetch user data',
      originalError: e,
    });
  }
}

/**
 * Make a password reset request.
 *
 * @throws {AuthError}
 */
function* resetPassword(email: string): Saga<void> {
  try {
    yield call(apiRequest, {
      auth: false,
      endpoint: '/reset_password',
      method: 'POST',
      body: { email },
    });
  } catch (e) {
    throw new errors.AuthError({
      message: 'unable to reset password',
      originalError: e,
    });
  }
}

/**
 * Make a password change request.
 *
 * @throws {AuthError}
 * @throws {InvalidResetLink}
 * @throws {InvalidPassword}
 */
function* changePassword(link: string, password: string): Saga<void> {
  try {
    yield call(apiRequest, {
      auth: false,
      endpoint: '/change_password',
      method: 'POST',
      body: { link, password },
    });
  } catch (e) {
    /* istanbul ignore else */
    if (e instanceof HTTPError) {
      if (e.status === 404 && e.json && e.json.error === 'User not found.') {
        throw new errors.InvalidResetLink({ originalError: e });
      }
      if (e.status === 401 && e.json && e.json.error === 'Reset token invalid.') {
        throw new errors.InvalidResetLink({ originalError: e });
      }
      if (e.status === 400 && e.json && e.json.message.match(/Password must be/)) {
        throw new errors.InvalidPassword({ originalError: e });
      }
    }

    throw new errors.AuthError({
      message: 'unable to change password',
      originalError: e,
    });
  }
}

/**
 * Get the code from the API.
 *
 * @throws {AuthError}
 */
function* getCode(): Saga<string> {
  try {
    const { code } = yield call(apiRequest, '/code');
    return code;
  } catch (e) {
    throw new errors.AuthError({
      message: 'unable to get the code',
      originalError: e,
    });
  }
}

/**
 * Refresh auth tokens.
 *
 * @throws {InvalidToken}
 * @throws {AuthError}
 */
function* refreshTokens(latency: number, tokens: Tokens): Saga<Tokens> {
  try {
    const newTokens = yield call(apiRequest, {
      auth: { tokens, handleInvalidToken: false },
      endpoint: '/refresh',
      method: 'POST',
    });
    return adjustTokensForLatency(newTokens, latency);
  } catch (e) {
    if (e instanceof HTTPError && e.status === 401) {
      throw new errors.InvalidToken({ originalError: e });
    }
    throw new errors.AuthError({
      message: 'unable to refresh tokens',
      originalError: e,
    });
  }
}

/**
 * Handle SIGN_IN action.
 * Make a sign-in request using the given credentials,
 * then request the user data using received tokens.
 * Finally, store the tokens and user data and dispatch a SIGN_IN_RESULT action.
 * Call resolve or reject callback.
 */
function* handleSignIn(
  { latency, storeTokens, storeUser },
  { payload: credentials, meta: { resolve, reject } }: actions.SignInAction,
): Saga<void> {
  try {
    const tokensRaw = yield call(signIn, credentials);
    const tokens = adjustTokensForLatency(tokensRaw, latency);
    const user = yield call(fetchUser, tokens);
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
 */
function* handleSignOut(
  { forgetTokens, forgetUser },
  { meta: { resolve, reject } }: actions.SignOutAction,
): Saga<void> {
  try {
    yield call(signOut);
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

const isExpired = (tokens: Tokens, time: number) => {
  // some backwards compatibility
  const exp = tokens.exp
    // istanbul ignore next
    || (tokens: any).expires_at
    // istanbul ignore next
    || (tokens: any).expires_on;
  return exp && exp < time;
};

/**
 * Handle CHECK action.
 * Check if the stored tokens are up-to-date.
 * Refresh tokens if stale, store the refreshed ones.
 * Then refetch and store user data if requested.
 */
function* handleCheck(
  { latency, storeTokens, storeUser, onAuthError },
  { payload: { refetch }, meta: { resolve, reject } }: actions.CheckAction,
): Saga<void> {
  try {
    const tokens = yield select(selectors.tokens);
    const time = yield call(timestamp);
    if (!tokens || !isExpired(tokens, time)) {
      /* istanbul ignore else */
      if (resolve) yield call(resolve);
      return;
    }

    yield put(actions.refresh());
    const newTokens = yield call(refreshTokens, latency, tokens);
    yield fork(storeTokens, newTokens);
    let user;
    if (refetch) {
      user = yield call(fetchUser, newTokens);
      yield fork(storeUser, user);
    }
    const payload = { tokens: newTokens, user };
    yield put(actions.refresh.resolve(payload));
    /* istanbul ignore else */
    if (resolve) yield call(resolve, payload);
  } catch (e) {
    yield put(actions.refresh.resolve(e));
    if (e instanceof errors.InvalidToken) {
      yield put(actions.authLost(e));
    } else {
      yield call(onAuthError, e);
    }
    /* istanbul ignore else */
    if (reject) yield call(reject, e);
  }
}

/**
 * Handle AUTH_LOST action.
 */
function* handleAuthLost(
  { forgetTokens, forgetUser, onAuthLost },
  { payload: err }: actions.AuthLostAction,
): Saga<void> {
  yield fork(forgetTokens);
  yield fork(forgetUser);
  yield call(onAuthLost, err);
}

/**
 * Handle SIGN_UP action.
 */
function* handleSignUp(
  { payload: credentials, meta: { resolve, reject } }: actions.SignUpAction,
): Saga<void> {
  try {
    yield call(signUp, credentials);
    yield call(resolve);
  } catch (e) {
    yield call(reject, e);
  }
}

/**
 * Handle RESET_PASSWORD action.
 */
function* handleResetPassword(
  { payload: email, meta: { resolve, reject } }: actions.ResetPasswordAction,
): Saga<void> {
  try {
    yield call(resetPassword, email);
    yield call(resolve);
  } catch (e) {
    yield call(reject, e);
  }
}

/**
 * Handle CHANGE_PASSWORD action.
 */
function* handleChangePassword(
  { payload: { link, password }, meta: { resolve, reject } }: actions.ChangePasswordAction,
): Saga<void> {
  try {
    yield call(changePassword, link, password);
    yield call(resolve);
  } catch (e) {
    yield call(reject, e);
  }
}

/**
 * Handle GET_CODE action.
 */
function* handleGetCode(
  { meta: { resolve, reject } }: actions.GetCodeAction,
): Saga<void> {
  try {
    const code = yield call(getCode);
    yield call(resolve, code);
  } catch (e) {
    yield call(reject, e);
  }
}

function* checkAuth(): Saga<void> {
  yield put(actions.check());
}

export type AuthSagaOptions = {
  latency: number,
  checkOn: Pattern,
  storeTokens: (t: Tokens) => void,
  forgetTokens: () => void,
  storeUser: (u: User) => void,
  forgetUser: () => void,
  onAuthLost: () => void,
  onAuthError: () => void,
};

/**
 * Main Auth saga.
 * Handles auth actions and fires CHECK action on specified condition.
 */
export default function* ({
  latency,
  checkOn,
  storeTokens,
  forgetTokens,
  storeUser,
  forgetUser,
  onAuthLost,
  onAuthError,
}: AuthSagaOptions): Saga<void> {
  yield takeEvery(actions.signIn.type, handleSignIn,
    { latency, storeTokens, storeUser });
  yield takeEvery(actions.signOut.type, handleSignOut,
    { forgetTokens, forgetUser });
  yield takeEvery(actions.check.type, handleCheck,
    { latency, storeTokens, storeUser, onAuthError });
  yield takeEvery(actions.authLost.type, handleAuthLost,
    { forgetTokens, forgetUser, onAuthLost });
  yield takeEvery(actions.signUp.type, handleSignUp);
  yield takeEvery(actions.resetPassword.type, handleResetPassword);
  yield takeEvery(actions.changePassword.type, handleChangePassword);
  yield takeEvery(actions.getCode.type, handleGetCode);

  if (checkOn) yield takeEvery(checkOn, checkAuth);
}
