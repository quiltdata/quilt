import id from 'lodash/identity';
import isFunction from 'lodash/isFunction';

export const unset = Symbol('reduxTools/unset');
export const noop = Symbol('reduxTools/noop');

/**
 * A redux action.
 *
 * @typedef {Object} Action
 */

/**
 * A redux reducer.
 *
 * @typedef {function} Reducer
 *
 * @param {any} state
 * @param {Action} action
 *
 * @returns {any}
 */

/**
 * Value to use for the current key.
 * If equals `unset` Symbol, unset the current key.
 * If equals `noop` Symbol, keep the value under the current key.
 * Otherwise, set the given value to the current key.
 *
 * @typedef {Symbol|any} Value
 */

/**
 * Function used to update the current value.
 *
 * @typedef {function} ValueUpdater
 *
 * @param {any} currentValue
 *
 * @returns {Value}
 *   The updated value.
 */

/**
 * Function used to handle an action.
 * Returns the new value or a ValueUpdater function.
 *
 * @typedef {function} ActionHandler
 *
 * @param {any} payload
 * @param {any} meta
 * @param {Action} action
 *
 * @returns {ValueUpdater|Value}
 */

/**
 * Combine handlers for given keys (state should be an Immutable Map).
 *
 * @param {Object.<string, ActionHandler|Value>} handlers
 *   Handler map (key -> handler).
 *   If handler is a Value, use it for the current key.
 *   If handler is a function (ActionHandler),
 *   call it with action.payload, action.meta and action.
 *   If result is a Value, use it for the current key.
 *   If result is a function (ValueUpdater),
 *   use it as an updater for the current key.
 *
 * @returns {Reducer}
 */
export const combine = (handlers) => (state, action) =>
  Object.entries(handlers).reduce((acc, [key, handler]) => {
    const updater = isFunction(handler) ? handler(action.payload, action.meta, action) : handler;
    const updated = isFunction(updater) ? updater(acc.get(key)) : updater;
    switch (updated) {
      case noop: return acc;
      case unset: return acc.remove(key);
      default: return acc.set(key, updated);
    }
  }, state);

/**
 * Create a reducer that handles actions based on a given reducer map.
 *
 * @param {Object.<string, Reducer>} reducers
 *   Reducer map (action type -> reducer).
 *
 * @returns {Reducer}
 */
export const handleActions = (reducers) => (state, action) =>
  (reducers[action.type] || id)(state, action);

/**
 * Create a reducer that handles transitions.
 *
 * @param {function} getState
 *   Selector for getting FSM state.
 *
 * @param {Object.<string, Reducer>} reducers
 *   Reducer map (FSM state -> Reducer).
 */
export const handleTransitions = (getState, reducers) => (state, action) =>
  (reducers[getState(state)] || id)(state, action);

/**
 * Sets the initial state for a reducer.
 *
 * @param {any} initialState
 * @param {Reducer} reducer
 *
 * @returns {Reducer}
 *   Reducer with the given initial state.
 */
export const withInitialState = (initialState, reducer) =>
  (state = initialState, action) => reducer(state, action);

/**
 * Create a reducer that uses different handlers for error and non-error actions.
 *
 * @param {Object} handlers
 * @param {Reducer} handlers.resolve
 *   Reducer used to handle non-error actions (with falsy error prop).
 * @param {Reducer} handlers.reject
 *   Reducer used to handle error actions (with truthy error prop).
 *
 *  @returns {Reducer}
 */
export const handleResult = ({ resolve, reject }) => (state, action) =>
  ((action.error ? reject : resolve) || id)(state, action);

/**
 * Create map of actions prefixed with the given scope.
 *
 * @param {string} scope
 * @param {...string} actions
 *
 * @returns {Object.<string, string>}
 *   A map of actions with the original strings as keys
 *   and the prefixed strings as values.
 */
export const createActions = (scope, ...actions) =>
  actions.reduce((acc, action) => ({ ...acc, [action]: `${scope}/${action}` }), {});


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
export const actionCreator = (type, create = () => {}) =>
  Object.assign((...args) => ({ type, ...create(...args) }), { type });
