/* storage - abstract persistence; currently uses
 * enforce write/read from predefined keys only */
import assert from 'assert';
import mapValues from 'lodash/mapValues';

export const keys = {
  user: 'RESPONSE',
  tokens: 'TOKENS', // auth response data
};
Object.freeze(keys);

const assertKey = (key, scope) =>
  assert(key in keys, `storage.${scope}: unexpected key: ${key}`);

export function get(key) {
  assertKey(key, 'get');
  return JSON.parse(localStorage.getItem(keys[key]));
}

export function set(key, value) {
  assertKey(key, 'set');
  return localStorage.setItem(keys[key], JSON.stringify(value));
}

export function remove(key) {
  assertKey(key, 'remove');
  return localStorage.removeItem(keys[key]);
}

export function load() {
  // user privacy may cause reads from localStorage to fail and throw
  try {
    return mapValues(keys, (_v, k) => get(k));
  } catch (err) {
    console.error('storage.load:', err); // eslint-disable-line no-console
    // let reducers determine state
    return undefined;
  }
}
