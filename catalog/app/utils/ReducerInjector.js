import invariant from 'invariant'
import isEmpty from 'lodash/isEmpty'
import isFunction from 'lodash/isFunction'
import isString from 'lodash/isString'
import * as R from 'ramda'
import * as React from 'react'
import { StoreContext } from 'redux-react-hook'

const scope = 'app/utils/ReducerInjector'

const isValidKey = (key) => isString(key) && !isEmpty(key)

/**
 * Create a reducer injector.
 *
 * @param {function} onSet
 *   Callback that gets called with the injected reducer map when it gets updated
 *   (a new reducer injected).
 *
 * @returns {{ inject: function, eject: function, injected: function }}
 *   An object containing reducer injection and ejection functions, which
 *   take a key (mountpoint) and a reducer (in case of injector).
 */
const createReducerInjector = (onSet) => {
  const innerScope = `${scope}/createReducerInjector`
  invariant(isFunction(onSet), `${innerScope}: Expected 'onSet' to be a function`)

  let reducers = {}

  const inject = (key, reducer) => {
    const innerScope2 = `${scope}/injectReducer`
    invariant(isValidKey(key), `${innerScope2}: Expected 'key' to be a non-empty string`)
    invariant(isFunction(reducer), `${innerScope2}: Expected 'reducer' to be a function`)
    // Check `reducers[key] === reducer` for hot reloading
    // when a key is the same but a reducer is different
    if (key in reducers && reducers[key] === reducer) return

    reducers = R.assoc(key, reducer, reducers)
    onSet(reducers)
  }

  const injected = (key, reducer) => {
    const current = reducers[key]
    const check = reducer ? R.equals(reducer) : Boolean
    return check(current)
  }

  const eject = (key) => {
    reducers = R.dissoc(key, reducers)
    onSet(reducers)
  }

  return { inject, eject, injected }
}

/**
 * React hook for reducer injection.
 *
 * @param {string} mountpoint
 *
 * @param {function} reducer
 *
 * @param {object} options
 *
 * @param {bool} options.remount
 *   Whether to remount reducer when a new one given.
 *   This option exists for compatibility with HoCs to opt-out from remounting
 *   and should be removed once the migration to hooks is complete.
 */
export const useReducer = (mountpoint, reducer, { remount = true } = {}) => {
  const { injector } = React.useContext(StoreContext)
  const shouldInject = remount
    ? !injector.injected(mountpoint, reducer)
    : !injector.injected(mountpoint)

  if (shouldInject) injector.inject(mountpoint, reducer)

  // keep reducers injected to avoid redux warnings
}
/**
 * Component that injects a given reducer into the store on mount.
 */
export const Inject = function ReducerInjector({
  children,
  /**
   * A key under which the reducer gets injected.
   */
  mount, // string.isRequired
  /**
   * A reducer that gets injected.
   */
  reducer, // func.isRequired
  /**
   * Whether to remount reducer when given a new one.
   */
  remount, // bool
}) {
  useReducer(mount, reducer, { remount })
  return children
}

/**
 * Create a store enhancer that attaches `injectReducer` method to the store.
 *
 * @param {function} createReducer
 *   A function that creates a reducer from the given reducer map.
 *
 * @returns {reduxTools.StoreEnhancer}
 */
export const withInjectableReducers = (createReducer) => (createStore) => (...args) => {
  const store = createStore(...args)
  const injector = createReducerInjector((injected) => {
    store.replaceReducer(createReducer(injected))
  })
  return { ...store, injector }
}
