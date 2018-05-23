/* Convenience wrapper for fetch
 * inspired by https://github.com/react-boilerplate/react-boilerplate/blob/master/app/utils/request.js */
import 'whatwg-fetch';
import invoke from 'lodash/fp/invoke';

import { BaseError } from 'utils/error';

export class HttpError extends BaseError {
  static displayName = 'HttpError';

  constructor(response) {
    super(response.statusText, {
      response,
      status: response.status,
    });
  }
}

function checkStatus(response) {
  if (response.ok) return response;
  window.err = new HttpError(response);
  throw new HttpError(response);
}

const mkRequest = (method) => {
  const process = invoke(method);
  return (...args) => request(...args).then(process);
};

export const requestJSON = mkRequest('json');

export const requestText = mkRequest('text');

export default function request(url, options) {
  /*
  const newOptions = Object.assign({}, options);
  newOptions.headers = newOptions.headers || {};
  // if user does not specify Cache-Control then use no-store
  // admittedly no-store is pretty aggressive https://developers.google.com/web/fundamentals/performance/optimizing-content-efficiency/http-caching
  // but by design most API calls in the app will benefit from fresh fetches
  // e.g. search results, user's payment plan, etc.
  if (!newOptions.headers['Cache-Control']) {
    newOptions.headers['Cache-Control'] = 'no-store';
  }
  */
  return fetch(url, options).then(checkStatus);
}
