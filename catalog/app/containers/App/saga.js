/* App sagas */
import { LOCATION_CHANGE } from 'react-router-redux';
import { call, put, select, takeLatest } from 'redux-saga/effects';

import { makeHeaders, makeHeadersFromTokens } from 'utils/auth';
import makeError from 'utils/error';
import config from 'constants/config';
import { requestJSON } from 'utils/request';
import { keys, removeStorage, setStorage } from 'utils/storage';
import { timestamp } from 'utils/time';
import { makeSelectLocation } from 'utils/router';
import { tokenPath } from 'constants/urls';

import {
  getAuthError,
  getAuthSuccess,
  getLogError,
  getLogSuccess,
  getManifestError,
  getManifestSuccess,
  getPackageError,
  getPackageSuccess,
  refreshAuth,
  storeTokens,
  routerStart,
} from './actions';
import {
  GET_AUTH,
  GET_AUTH_SUCCESS,
  GET_LOG,
  GET_PACKAGE,
  GET_PACKAGE_SUCCESS,
  intercomAppId as app_id, // eslint-disable-line camelcase
  ROUTER_START,
  SIGN_OUT,
  STORE_TOKENS,
} from './constants';
import {
  makeSelectAuth,
  makeSelectPackageSummary,
  makeSelectSignedIn,
  makeSelectUserName,
} from './selectors';

//TODO /api/log/<owner>/<package_name>/

function* doIntercom(action) {
  try {
    let intercomAction;
    let sendData = true;
    switch (action.type) {
      case ROUTER_START:
      case GET_AUTH_SUCCESS:
        intercomAction = 'boot';
        break;
      case LOCATION_CHANGE:
        intercomAction = 'update';
        break;
      case SIGN_OUT:
        intercomAction = 'shutdown';
        sendData = false;
        break;
      default:
        throw new Error(`intercom doesn't respond to ${action}`);
    }
    const user_id = yield select(makeSelectUserName()); // eslint-disable-line camelcase
    const data = user_id ? { app_id, name: user_id, user_id } : { app_id }; // eslint-disable-line camelcase
    if (window.Intercom) {
      yield call(window.Intercom, intercomAction, sendData ? data : undefined);
    }
  } catch (error) {
    yield call(console.error, error); // eslint-disable-line no-console
  }
}

function* doGetAuth(action) {
  try {
    const { userApi } = config;
    const headers = makeHeadersFromTokens(action.tokens);
    const auth = yield call(requestJSON, userApi, { method: 'GET', headers });
    if (auth.login && !auth.current_user) {
      // GitHub
      auth.current_user = auth.login;
    }
    yield put(getAuthSuccess(auth));
  } catch (err) {
    err.headline = 'Auth error';
    err.detail = `doGetAuth: ${err.message}`;
    yield put(getAuthError(err));
  }
}

function* doGetLog(action) {
  try {
    const { name, owner } = action;
    const { api: server } = config;
    const endpoint = `${server}/api/log/${owner}/${name}/`;
    const headers = yield call(makeHeaders);
    const response = yield call(requestJSON, endpoint, { method: 'GET', headers });
    yield put(getLogSuccess(response));
  } catch (error) {
    error.headline = 'Log hiccup';
    error.detail = `doGetLog: ${error.message}`;
    yield put(getLogError(error));
  }
}
// incoming action is the response from GET_MANIFEST_SUCCESS
// and use takeLatest(function) to discriminate
function* doGetManifest() {
  try {
    const { name, owner, hash } = yield select(makeSelectPackageSummary());
    const { api: server } = config;
    const endpoint = `${server}/api/package_preview/${owner}/${name}/${hash}`;
    const headers = yield call(makeHeaders);
    const response = yield call(requestJSON, endpoint, { method: 'GET', headers });
    yield put(getManifestSuccess(response));
  } catch (error) {
    error.headline = 'Manifest hiccup';
    error.detail = `doGetManifest: ${error.message}`;
    yield put(getManifestError(error));
  }
}

function* doGetPackage(action) {
  try {
    const { api: server } = config;
    const { owner, name } = action;
    // the difference between makeHeaders (generator) and makeHeadersFromTokens
    // (function): the latter is for the case where we have tokens already so no need
    // for selectors; the former selects the tokens from scratch
    const headers = yield call(makeHeaders);
    const endpoint = `${server}/api/tag/${owner}/${name}/latest`;
    const response = yield call(requestJSON, endpoint, { method: 'GET', headers });
    if (response.message) {
      throw makeError('Package hiccup', response.message);
    }
    yield put(getPackageSuccess(response));
  } catch (err) {
    if (!err.headline) {
      err.headline = 'Package hiccup';
      err.detail = `doGetPackage: ${err.message}`;
    }
    yield put(getPackageError(err));
  }
}

function* doRefresh(action) {
  // no reason to refresh on oauth_callback route; only time we enter that
  // route is when a log in is in progress
  if (action.payload && action.payload.pathname.startsWith('/oauth_callback')) {
    return;
  }
  // before we do anything, polyfill location.origin for IE 10
  // do this here because it fires on router start and any router navigation
  // HACK theoretically a very quick user could hit Sign In before this fills
  // or this could finish before the router has changed window.location so
  // TODO resolve race condition
  if (!window.location.origin) {
    const { protocol, host } = window.location;
    window.location.origin = `${protocol}//${host}`;
  }

  // state.router is not set the first time the browser hits a route
  // from a cold start, so we look in app.location which our code has set
  const authenticated = yield select(makeSelectSignedIn());
  const storedAuth = yield select(makeSelectAuth());
  const tokens = storedAuth.tokens || {};
  const { refresh_token: refreshToken } = tokens;
  // "expires_at" used to be "expires_on"
  const expiresAt = tokens.expires_at || tokens.expires_on;

  // if we should refresh
  if (authenticated && refreshToken && expiresAt && expiresAt < timestamp()) {
    // it's critical to yield this immediately so that the logic in
    // components/Profile.js will know whether this is an unauthenticated user
    // hitting /profile or if there's a refresh in progress
    yield put(refreshAuth());
    try {
      const { api: server, userApi } = config;
      const endpoint = `${server}${tokenPath}`;
      const body = new FormData();
      body.append('refresh_token', refreshToken);
      const newTokens = yield call(requestJSON, endpoint, { method: 'POST', body });
      // response could be ok per request method checks but still harbor error
      if (newTokens.error) {
        throw makeError('Auth refresh hiccup', `doRefresh: ${newTokens.error}`);
      }
      yield put(storeTokens(newTokens));

      // TODO consolidate this logic with identical code in getAuth
      const headers = makeHeadersFromTokens(newTokens);
      const auth = yield call(requestJSON, userApi, { method: 'GET', headers });
      if (auth.login && !auth.current_user) {
        // GitHub
        auth.current_user = auth.login;
      }
      yield put(getAuthSuccess(auth));
    } catch (err) {
      if (!err.headline) {
        err.headline = 'Auth refresh hiccup';
        err.detail = `doRefresh: ${err.message}`;
      }
      yield put(getAuthError(err));
    }
  }
}

function* doSignOut() {
  // wipe auth tokens and username from storage
  yield call(removeStorage, keys.TOKENS);
  yield call(removeStorage, keys.RESPONSE);
  if (window.Intercom) {
    yield call(window.Intercom, 'shutdown');
  }
}

function* doStoreResponse(action) {
  yield call(setStorage, keys.RESPONSE, JSON.stringify(action.response));
}

function* doStoreTokens(action) {
  yield call(setStorage, keys.TOKENS, JSON.stringify(action.response));
}

function* doRouterStart() {
  const location = yield select(makeSelectLocation());
  yield put(routerStart(location));
}

export default function* () {
  yield takeLatest(GET_AUTH, doGetAuth);

  yield takeLatest(GET_AUTH_SUCCESS, doStoreResponse);
  yield takeLatest(GET_AUTH_SUCCESS, doIntercom);

  yield takeLatest(GET_LOG, doGetLog);

  yield takeLatest(GET_PACKAGE, doGetPackage);
  yield takeLatest(GET_PACKAGE_SUCCESS, doGetManifest);

  yield takeLatest(ROUTER_START, doRefresh);
  yield takeLatest(ROUTER_START, doIntercom);

  yield takeLatest(LOCATION_CHANGE, doRefresh);
  yield takeLatest(LOCATION_CHANGE, doIntercom);

  yield takeLatest(SIGN_OUT, doSignOut);
  yield takeLatest(SIGN_OUT, doIntercom);

  yield takeLatest(STORE_TOKENS, doStoreTokens);

  yield call(doRouterStart);
}
