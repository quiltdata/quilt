import { call, put, select, fork, takeEvery } from 'redux-saga/effects';

import config from 'constants/config';
import { tokenPath } from 'constants/urls';
import makeError from 'utils/error';
import { requestJSON } from 'utils/request';
import { waitTil } from 'utils/sagaTools';
import { timestamp } from 'utils/time';

import { signIn, refresh, check } from './actions';
import { actions } from './constants';
import * as selectors from './selectors';
import { adjustTokensForLatency, makeHeadersFromTokens } from './util';


export function* makeHeaders() {
  let resolve;
  const checked = new Promise((res) => { resolve = res; });
  yield put(check({ refetch: false, onComplete: resolve }));
  yield checked;
  yield call(waitTil, selectors.waiting, (w) => !w);

  const authenticated = yield select(selectors.authenticated);
  if (!authenticated) return {};

  const tokens = yield select(selectors.tokens);
  return makeHeadersFromTokens(tokens);
}

function* fetchUser(tokens) {
  try {
    const auth = yield call(requestJSON, config.userApi, {
      headers: makeHeadersFromTokens(tokens),
    });
    /* istanbul ignore next */
    return auth.login && !auth.current_user
      // GitHub
      ? { ...auth, current_user: auth.login }
      : auth;
  } catch (err) {
    /* istanbul ignore next */
    if (!err.headline) {
      err.headline = 'Auth request hiccup';
      err.detail = `fetchUser: ${err.message}`;
    }
    throw err;
  }
}

function* refreshTokens(refreshToken) {
  const body = new FormData();
  body.append('refresh_token', refreshToken);
  const newTokens = yield call(requestJSON, `${config.api}${tokenPath}`, {
    method: 'POST',
    body,
  });
  // response could be ok per request method checks but still harbor error
  if (newTokens.error) {
    throw makeError('Auth refresh hiccup', `refreshTokens: ${newTokens.error}`);
  }
  return adjustTokensForLatency(newTokens);
}

const isExpired = (tokens, time) => {
  // "expires_at" used to be "expires_on"
  const expiresAt = tokens.expires_at || /* istanbul ignore next */ tokens.expires_on;
  return expiresAt && expiresAt < time;
};

const handleSignIn = ({ storeTokens, storeUser, forgetTokens }) =>
  function* signInHandler({ payload: tokens, meta: { onSuccess, onError } }) {
    try {
      yield fork(storeTokens, tokens);
      const user = yield call(fetchUser, tokens);
      yield fork(storeUser, user);
      yield put(signIn.success(user));
      /* istanbul ignore else */
      if (onSuccess) yield call(onSuccess, user);
    } catch (e) {
      yield fork(forgetTokens);
      yield put(signIn.error(e));
      /* istanbul ignore else */
      if (onError) yield call(onError, e);
    }
  };

const handleSignOut = ({ forgetTokens, forgetUser }) =>
  function* signOutHandler({ meta: { onSuccess } }) {
    yield fork(forgetUser);
    yield fork(forgetTokens);
    /* istanbul ignore else */
    if (onSuccess) yield call(onSuccess);
  };

// TODO: move to router
// before we do anything, polyfill location.origin for IE 10
// do this here because it fires on router start and any router navigation
// HACK theoretically a very quick user could hit Sign In before this fills
// or this could finish before the router has changed window.location so
// TODO resolve race condition
/*
if (!window.location.origin) {
  const { protocol, host } = window.location;
  window.location.origin = `${protocol}//${host}`;
}
*/

const handleCheck = ({ storeTokens, storeUser, forgetTokens, forgetUser, onAuthLost }) =>
  function* checkHandler({ payload: { refetch }, meta: { onComplete } }) {
    try {
      const tokens = yield select(selectors.tokens);
      const time = yield call(timestamp);
      if (!tokens.refresh_token || !isExpired(tokens, time)) {
        if (onComplete) yield call(onComplete);
        return;
      }

      yield put(refresh());
      const newTokens = yield call(refreshTokens, tokens.refresh_token);
      yield fork(storeTokens, newTokens);
      let user;
      if (refetch) {
        user = yield call(fetchUser, newTokens);
        yield fork(storeUser, user);
      }
      yield put(refresh.success(newTokens, user));
      if (onComplete) yield call(onComplete);
    } catch (e) {
      yield fork(forgetTokens);
      yield fork(forgetUser);
      yield put(refresh.error(e));
      if (onComplete) yield call(onComplete);
      yield call(onAuthLost, e);
    }
  };

const handleAuthLost = ({ onAuthLost }) =>
  function* authLostHandler({ payload: err }) {
    yield call(onAuthLost, err);
  };

const noop = () => {};

export default function* (/* istanbul ignore next */ {
  checkOn,
  storeTokens = noop,
  forgetTokens = noop,
  storeUser = noop,
  forgetUser = noop,
  onAuthLost = noop,
} = {}) {
  yield takeEvery(actions.SIGN_IN, handleSignIn({ storeTokens, storeUser, forgetTokens }));
  yield takeEvery(actions.SIGN_OUT, handleSignOut({ forgetTokens, forgetUser }));
  yield takeEvery(actions.CHECK, handleCheck({ storeTokens, storeUser, forgetTokens, forgetUser, onAuthLost }));
  yield takeEvery(actions.AUTH_LOST, handleAuthLost({ onAuthLost }));

  if (checkOn) yield takeEvery(checkOn, function* checkAuth() { yield put(check()); });
}
