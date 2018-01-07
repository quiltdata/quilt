/* Gallery actions */

import {
  GET_LATEST,
  GET_LATEST_ERROR,
  GET_LATEST_SUCCESS,
} from './constants';

export function getLatest() {
  return {
    type: GET_LATEST,
  };
}

export function getLatestError(error) {
  return {
    type: GET_LATEST_ERROR,
    error,
  };
}

/* PRE: response is a JS object (parsed JSON) */
export function getLatestSuccess(response) {
  return {
    type: GET_LATEST_SUCCESS,
    response,
  };
}
