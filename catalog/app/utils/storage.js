/* storage - abstract persistence; currently uses
 * enforce write/read from predefined keys only */
import assert from 'assert';
import { fromJS } from 'immutable';

export const keys = {
  RESPONSE: 'RESPONSE',
  TOKENS: 'TOKENS', // auth response data
};
Object.freeze(keys);

export function getStorage(key) {
  assert(key in keys, `unexpected key: ${key}`);
  return localStorage.getItem(key);
}

export function setStorage(key, value) {
  assert(key in keys, `unexpected key: ${key}`);
  assert(typeof value === 'string', `value should be a string: ${value}`);
  return localStorage.setItem(key, value);
}

export function removeStorage(key) {
  return localStorage.removeItem(key);
}

export const loadState = () => {
  // user privacy may cause reads from localStorage to fail and throw
  try {
    // we only store a subset of the state, related to auth
    const response = JSON.parse(getStorage(keys.RESPONSE));
    const tokens = JSON.parse(getStorage(keys.TOKENS));
    const state = {
      app: {
        user: {
          auth: {
            response,
            tokens,
          },
        },
      },
    };
    // hydrate the store if we can
    return fromJS(state);
  } catch (err) {
    console.error('loadState:', err); // eslint-disable-line no-console
    return undefined; // let reducers determine state
  }
};
