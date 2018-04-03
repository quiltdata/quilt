/* Convenience wrapper for fetch
 * inspired by https://github.com/react-boilerplate/react-boilerplate/blob/master/app/utils/request.js */
import 'whatwg-fetch';

function checkStatus(response) {
  if (response.ok) {
    return response;
  }
  const error = new Error(response.statusText);
  error.response = response;
  throw error;
}

export function requestJSON(url, options) {
  return request(url, options)
    .then(checkStatus)
    .then((response) => response.json());
}

export function requestText(url) {
  return request(url)
    .then(checkStatus)
    .then((response) => response.text());
}

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
  return fetch(url, options);
}
