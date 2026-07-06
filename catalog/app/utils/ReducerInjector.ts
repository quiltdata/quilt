import invariant from 'invariant'
import isEmpty from 'lodash/isEmpty'
import isFunction from 'lodash/isFunction'
import isString from 'lodash/isString'
import * as R from 'ramda'
import * as React from 'react'
import * as redux from 'react-redux'

const scope = 'app/utils/ReducerInjector'

type AnyReducer = (...args: any[]) => any

interface ReducerInjectorApi {
  inject(key: string, reducer: AnyReducer): void
  eject(key: string): void
  injected(key: string, reducer?: AnyReducer): boolean
}

const isValidKey = (key: unknown): key is string => isString(key) && !isEmpty(key)

/**
 * Create a reducer injector. `onSet` is called with the injected reducer map
 * whenever a new reducer is injected.
 */
const createReducerInjector = (
  onSet: (reducers: Record<string, AnyReducer>) => void,
): ReducerInjectorApi => {
  const innerScope = `${scope}/createReducerInjector`
  invariant(isFunction(onSet), `${innerScope}: Expected 'onSet' to be a function`)

  let reducers: Record<string, AnyReducer> = {}

  const inject = (key: string, reducer: AnyReducer) => {
    const innerScope2 = `${scope}/injectReducer`
    invariant(isValidKey(key), `${innerScope2}: Expected 'key' to be a non-empty string`)
    invariant(isFunction(reducer), `${innerScope2}: Expected 'reducer' to be a function`)
    // Check `reducers[key] === reducer` for hot reloading
    // when a key is the same but a reducer is different
    if (key in reducers && reducers[key] === reducer) return

    reducers = R.assoc(key, reducer, reducers)
    onSet(reducers)
  }

  const injected = (key: string, reducer?: AnyReducer) => {
    const current = reducers[key]
    const check = reducer ? R.equals(reducer) : Boolean
    return check(current)
  }

  const eject = (key: string) => {
    reducers = R.dissoc(key, reducers)
    onSet(reducers)
  }

  return { inject, eject, injected }
}

interface InjectableStore {
  injector: ReducerInjectorApi
}

/** React hook for reducer injection. */
export const useReducer = (
  mountpoint: string,
  reducer: AnyReducer,
  { remount = true }: { remount?: boolean } = {},
) => {
  const { injector } = redux.useStore() as unknown as InjectableStore
  const shouldInject = remount
    ? !injector.injected(mountpoint, reducer)
    : !injector.injected(mountpoint)

  if (shouldInject) injector.inject(mountpoint, reducer)

  // keep reducers injected to avoid redux warnings
}

interface InjectProps {
  children: React.ReactNode
  /** A key under which the reducer gets injected. */
  mount: string
  /** A reducer that gets injected. */
  reducer: AnyReducer
  /** Whether to remount reducer when given a new one. */
  remount?: boolean
}

/** Component that injects a given reducer into the store on mount. */
export const Inject = function ReducerInjector({
  children,
  mount,
  reducer,
  remount,
}: InjectProps) {
  useReducer(mount, reducer, { remount })
  return children
}

/**
 * Create a store enhancer that attaches an `injector` to the store.
 * `createReducer` builds a reducer from the given reducer map.
 */
export const withInjectableReducers =
  (createReducer: (reducers: Record<string, AnyReducer>) => AnyReducer) =>
  (createStore: (...args: any[]) => any) =>
  (...args: any[]) => {
    const store = createStore(...args)
    const injector = createReducerInjector((injected) => {
      store.replaceReducer(createReducer(injected))
    })
    return { ...store, injector }
  }
