/* storage - abstract persistence; currently uses
 * enforce write/read from predefined keys only */
import invariant from 'invariant'
import mapValues from 'lodash/mapValues'

// Maps logical key names to the actual localStorage keys they persist under.
type Keys = Record<string, string>

export interface Storage<K extends Keys> {
  get: <T = any>(key: keyof K) => T
  set: (key: keyof K, value: unknown) => void
  remove: (key: keyof K) => void
  load: () => { [P in keyof K]: any } | undefined
}

export default <K extends Keys>(keys: K): Storage<K> => {
  const assertKey = (key: keyof K, scope: string) =>
    invariant(key in keys, `storage.${scope}: unexpected key: ${String(key)}`)

  function get<T = any>(key: keyof K): T {
    assertKey(key, 'get')
    return JSON.parse(localStorage.getItem(keys[key]) as string)
  }

  function set(key: keyof K, value: unknown) {
    assertKey(key, 'set')
    return localStorage.setItem(keys[key], JSON.stringify(value))
  }

  function remove(key: keyof K) {
    assertKey(key, 'remove')
    return localStorage.removeItem(keys[key])
  }

  function load(): { [P in keyof K]: any } | undefined {
    // user privacy may cause reads from localStorage to fail and throw
    try {
      return mapValues(keys, (_v, k) => get(k as keyof K))
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
