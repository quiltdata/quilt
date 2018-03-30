/* App actions */

import {
  GET_AUTH,
  GET_AUTH_ERROR,
  GET_AUTH_SUCCESS,
  GET_LOG,
  GET_LOG_ERROR,
  GET_LOG_SUCCESS,
  GET_MANIFEST,
  GET_MANIFEST_ERROR,
  GET_MANIFEST_SUCCESS,
  GET_PACKAGE,
  GET_PACKAGE_ERROR,
  GET_PACKAGE_SUCCESS,
  LATENCY_SECONDS,
  NO_OP,
  REFRESH_AUTH,
  ROUTER_START,
  SET_SEARCH_TEXT,
  SIGN_OUT,
  STORE_TOKENS,
} from './constants';

export function getAuth(tokens) {
  return {
    type: GET_AUTH,
    tokens,
  };
}

export function getAuthError(error) {
  return {
    type: GET_AUTH_ERROR,
    error,
  };
}

/* PRE: response is a JS object (parsed JSON) */
export function getAuthSuccess(response) {
  return {
    type: GET_AUTH_SUCCESS,
    response,
  };
}

export function getLog(owner, name) {
  return {
    type: GET_LOG,
    owner,
    name,
  };
}

export function getLogError(error) {
  return {
    type: GET_LOG_ERROR,
    error,
  };
}

export function getLogSuccess(response) {
  return {
    type: GET_LOG_SUCCESS,
    response,
  };
}

export function getManifest(owner, name, hash) {
  return {
    type: GET_MANIFEST,
    owner,
    name,
    hash,
  };
}

export function getManifestError(error) {
  return {
    type: GET_MANIFEST_ERROR,
    error,
  };
}

export function getManifestSuccess(response) {
  return {
    type: GET_MANIFEST_SUCCESS,
    response,
  };
}

export function getPackage(owner, name) {
  return {
    type: GET_PACKAGE,
    owner,
    name,
  };
}

export function getPackageError(error) {
  return {
    type: GET_PACKAGE_ERROR,
    error,
  };
}

export function getPackageSuccess(response) {
  return {
    type: GET_PACKAGE_SUCCESS,
    response,
  };
}

export function noOp() {
  return {
    type: NO_OP,
  };
}

export function refreshAuth() {
  return {
    type: REFRESH_AUTH,
  };
}

export function routerStart(payload) {
  return {
    type: ROUTER_START,
    payload,
  };
}

export function setSearchText(text) {
  return {
    type: SET_SEARCH_TEXT,
    text,
  };
}

export function signOut() {
  return {
    type: SIGN_OUT,
  };
}

export function storeTokens(response) {
  const modified = Object.assign({}, response);
  // HACK; ideally we would do this with the reducer but then
  // localStorage wouldn't get this update since it also
  // listens for STORE_TOKENS
  modified.expires_at -= LATENCY_SECONDS;
  return {
    type: STORE_TOKENS,
    response: modified,
  };
}
