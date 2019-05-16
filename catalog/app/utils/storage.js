/* storage - abstract persistence; currently uses
 * enforce write/read from predefined keys only */
import assert from 'assert'
import mapValues from 'lodash/mapValues'

export default (keys) => {
  const assertKey = (key, scope) =>
    assert(key in keys, `storage.${scope}: unexpected key: ${key}`)

  function get(key) {
    assertKey(key, 'get')
    return JSON.parse(localStorage.getItem(keys[key]))
  }

  function set(key, value) {
    assertKey(key, 'set')
    return localStorage.setItem(keys[key], JSON.stringify(value))
  }

  function remove(key) {
    assertKey(key, 'remove')
    return localStorage.removeItem(keys[key])
  }

  function load() {
    // user privacy may cause reads from localStorage to fail and throw
    try {
      return mapValues(keys, (_v, k) => get(k))
    } catch (err) {
      console.error('storage.load:', err) // eslint-disable-line no-console
      // let reducers determine state
      return undefined
    }
  }

  return {
    get,
    set,
    remove,
    load,
  }
}
