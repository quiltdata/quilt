/* App actions */

import {
  GET_LOG,
  GET_LOG_ERROR,
  GET_LOG_SUCCESS,
  GET_MANIFEST,
  GET_MANIFEST_ERROR,
  GET_MANIFEST_SUCCESS,
  GET_PACKAGE,
  GET_PACKAGE_ERROR,
  GET_PACKAGE_SUCCESS,
  GET_TRAFFIC,
  GET_TRAFFIC_RESPONSE,
  SET_SEARCH_TEXT,
  START,
} from './constants';


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

export function setSearchText(text) {
  return {
    type: SET_SEARCH_TEXT,
    text,
  };
}

export function start() {
  return {
    type: START,
  };
}

export const getTraffic = (owner, name) => ({
  type: GET_TRAFFIC,
  payload: { owner, name },
});

export const getTrafficResponse = (response) => ({
  type: GET_TRAFFIC_RESPONSE,
  payload: response,
  error: response instanceof Error,
});
