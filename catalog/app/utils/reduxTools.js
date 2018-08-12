// @flow

import { type Map } from 'immutable';
import isFunction from 'lodash/isFunction';

// export const unset = Symbol('reduxTools/unset');
// export const noop = Symbol('reduxTools/noop');
export const unset = '@@app/reduxTools/unset';
export const noop = '@@app/reduxTools/noop';

/**
 * A redux action.
 */
export type Action = {
  type: string,
  error?: bool,
};

/**
 * Immutable Map representing a store state.
 */
export type StateMap = Map<string, mixed>;

/**
 * A redux selector.
 */
export type Selector<T> = (state: StateMap) => T;

/**
 * A redux reducer.
 */
export type Reducer = (state: StateMap, action: Action) => StateMap;

/**
 * Value to use for the current key.
 * If equals `unset` Symbol, unset the current key.
 * If equals `noop` Symbol, keep the value under the current key.
 * Otherwise, set the given value to the current key.
 */
export type ValueUpdate<T> = typeof noop | typeof unset | T;

/**
 * Function used to update the current value.
 */
export type ValueUpdater<T> = (current: T) => ValueUpdate<T>;

/**
 * Function used to handle an action.
 * Returns the new value or a ValueUpdater function.
 */
export type ActionHandler<T> = (
  payload: *,
  meta: *,
  action: Action,
) => ValueUpdater<T> | ValueUpdate<T>;

/**
 * Identity reducer, returns unmodified state.
 */
const idReducer = (state: StateMap, _action: Action): StateMap => state;

type MkHandler = <T>(value: T) => ActionHandler<T> | ValueUpdate<T>;

// $Rest is needed to make all the keys optional
type HandlerMap<State> = $ObjMap<$Shape<State>, ?MkHandler>;

/**
 * Combine handlers for given keys (state should be an Immutable Map).
 */
export const combine = <State: {}>(
  /**
   * Handler map (key -> handler).
   * If handler is a Value, use it for the current key.
   * If handler is a function (ActionHandler),
   * call it with action.payload, action.meta and action.
   * If result is a Value, use it for the current key.
   * If result is a function (ValueUpdater),
   * use it as an updater for the current key.
   */
  handlers: HandlerMap<State>
): Reducer =>
    // for some reason eslint believes the function body should be indented this far
    (state, action: any) =>
      Object.entries(handlers).reduce((acc, [key, handler]) => {
        const updater = isFunction(handler)
          ? handler(action.payload, action.meta, action)
          : handler;
        const updated = isFunction(updater)
          ? updater(acc.get(key))
          : updater;
        switch (updated) {
          case noop: return acc;
          case unset: return acc.remove(key);
          default: return acc.set(key, updated);
        }
      }, state);

/**
 * Create a reducer that handles actions based on a given reducer map.
 */
export const handleActions = (
  /**
   * Reducer map (action type -> reducer).
   */
  reducers: { [type: string]: Reducer }
): Reducer => (state, action) =>
  (reducers[action.type] || idReducer)(state, action);

/**
 * Create a reducer that handles transitions.
 *
 * @param {function} getState
 *   Selector for getting FSM state.
 *
 * @param {Object.<string, Reducer>} reducers
 *   Reducer map (FSM state -> Reducer).
 */
export const handleTransitions = (
  getState: Selector<?string>,
  reducers: { [key: string ]: Reducer },
): Reducer =>
  (state, action) => {
    const st = getState(state);
    return ((st ? reducers[st] : undefined) || idReducer)(state, action);
  };

/**
 * Sets the initial state for a reducer.
 *
 * @param {any} initialState
 * @param {Reducer} reducer
 *
 * @returns {Reducer}
 *   Reducer with the given initial state.
 */
export const withInitialState = (initialState: StateMap, reducer: Reducer): Reducer =>
  (state = initialState, action) => reducer(state, action);

/**
 * Create a reducer that uses different handlers for error and non-error actions.
 */
export const handleResult = (
  { resolve, reject }: {
    /**
     * Reducer used to handle non-error actions (with falsy error prop).
     */
    resolve: ?Reducer,
    /**
     * Reducer used to handle error actions (with truthy error prop).
     */
    reject: ?Reducer,
  },
): Reducer =>
  (state, action) =>
    ((action.error ? reject : resolve) || idReducer)(state, action);

/**
 * Create map of actions prefixed with the given scope.
 *
 * @returns {Object.<string, string>}
 *   A map of actions with the original strings as keys
 *   and the prefixed strings as values.
 */
export const createActions = (
  scope: string,
  ...actions: string[]
): { [key: string]: string } =>
  actions.reduce((acc, action) => ({ ...acc, [action]: `${scope}/${action}` }), {});

type ActionTypeType<A: Action> = $PropertyType<A, 'type'>;

type ActionContents<A: Action> = $Diff<A, { type: ActionTypeType<A> }>;

type ActionCreator<A> =
  & ((...args: any) => A)
  & { type: ActionTypeType<A> };

type CreateAction<A> = (...args: any) => ActionContents<A>;

/**
 * Create an action creator for the given action type.
 *
 * @param {string} type
 *   Action type (exposed as .type on the resulting function for convenience).
 *
 * @param {function} create
 *   Wrapped action creator function, which is called with the arguments
 *   provided to the resulting function.
 *   Result of calling it is extended with the .type prop provided above.
 *
 * @returns {function} The action creator.
 */
export const actionCreator = <A: Action>(
  type: string,
  create: CreateAction<A> = () => ({}: any),
): ActionCreator<A> =>
    // for some reason eslint believes the function body should be indented this far
    Object.assign((...args) => ({ type, ...create(...args) }), { type });
