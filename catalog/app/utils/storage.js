/* storage - abstract persistence; currently uses
 * enforce write/read from predefined keys only */
import assert from 'assert';
import mapValues from 'lodash/mapValues';

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

export function loadState() {
  // user privacy may cause reads from localStorage to fail and throw
  try {
    return mapValues(keys, (key) => JSON.parse(getStorage(key)));
  } catch (err) {
    console.error('loadState:', err); // eslint-disable-line no-console
    return undefined; // let reducers determine state
  }
}
