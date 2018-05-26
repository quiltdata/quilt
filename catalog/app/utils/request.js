/* Convenience wrapper for fetch
 * inspired by https://github.com/react-boilerplate/react-boilerplate/blob/master/app/utils/request.js */
import 'whatwg-fetch';
import invoke from 'lodash/fp/invoke';

import { BaseError } from 'utils/error';

export class HttpError extends BaseError {
  static displayName = 'HttpError';

  constructor(response, text) {
    let json;
    // eslint-disable-next-line no-empty
    try { json = JSON.parse(text); } catch (e) {}

    super(response.statusText, {
      response,
      status: response.status,
      text,
      json,
    });
  }
}

function checkStatus(response) {
  if (response.ok) return response;
  return response.text().then((text) => {
    throw new HttpError(response, text);
  });
}

const pipeP = (first, ...rest) => (...args) =>
  rest.reduce(
    (res, fn) => res.then(fn),
    Promise.resolve().then(() => first(...args)),
  );

export const requestJSON = pipeP(request, invoke('json'));

export const requestText = pipeP(request, invoke('text'));

/**
 * Make an http request.
 *
 * @param {string} url
 * @param {Object} options
 *   Options passed to the `fetch` call.
 *
 * @throws {HttpError}
 */
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
