import id from 'lodash/identity'
import isFunction from 'lodash/isFunction'

export const unset = Symbol('reduxTools/unset')
export const noop = Symbol('reduxTools/noop')

export interface Action {
  type: string
  payload?: any
  meta?: any
  error?: any
  [key: string]: any
}

export type Reducer<S = any> = (state: S, action: Action) => S

/**
 * Value to use for the current key: the `unset` symbol removes the key, the
 * `noop` symbol keeps it, anything else is set as the new value.
 */
type Value = typeof unset | typeof noop | any

/** Updates the current value for a key. */
type ValueUpdater = (currentValue: any) => Value

/** Handles an action, returning a new value or a ValueUpdater. */
type ActionHandler = (payload: any, meta: any, action: Action) => Value | ValueUpdater

/**
 * Combine handlers for given keys (state should be an Immutable Map).
 * A function handler is called with (payload, meta, action); a non-function
 * handler is used directly. A function result is used as a ValueUpdater.
 */
export const combine =
  (handlers: Record<string, ActionHandler | Value>): Reducer =>
  (state: any, action: Action) =>
    Object.entries(handlers).reduce((acc, [key, handler]) => {
      const updater = isFunction(handler)
        ? handler(action.payload, action.meta, action)
        : handler
      const updated = isFunction(updater) ? updater(acc.get(key)) : updater
      switch (updated) {
        case noop:
          return acc
        case unset:
          return acc.remove(key)
        default:
          return acc.set(key, updated)
      }
    }, state)

/** Create a reducer that dispatches on action type. */
export const handleActions =
  (reducers: Record<string, Reducer>): Reducer =>
  (state, action) =>
    (reducers[action.type] || id)(state, action)

/** Create a reducer that dispatches on FSM state. */
export const handleTransitions =
  (getState: (state: any) => string, reducers: Record<string, Reducer>): Reducer =>
  (state, action) =>
    (reducers[getState(state)] || id)(state, action)

/** Sets the initial state for a reducer. */
export const withInitialState =
  <S>(initialState: S, reducer: Reducer<S>): Reducer<S> =>
  // eslint-disable-next-line @typescript-eslint/default-param-last
  (state = initialState, action) =>
    reducer(state, action)

/** Use different handlers for error and non-error actions. */
export const handleResult =
  ({ resolve, reject }: { resolve?: Reducer; reject?: Reducer }): Reducer =>
  (state, action) =>
    ((action.error ? reject : resolve) || id)(state, action)

/**
 * Create a map of actions prefixed with the given scope (original strings as
 * keys, prefixed strings as values).
 */
export const createActions = (
  scope: string,
  ...actions: string[]
): Record<string, string> =>
  actions.reduce((acc, action) => ({ ...acc, [action]: `${scope}/${action}` }), {})

/**
 * Create an action creator for the given type. The wrapped `create` function is
 * called with the provided arguments and its result extended with `.type`. The
 * resulting function also exposes `.type` for convenience.
 */
export const actionCreator = (
  type: string,
  create: (...args: any[]) => object = () => ({}),
) => Object.assign((...args: any[]) => ({ type, ...create(...args) }), { type })
