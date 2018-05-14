import get from 'lodash/get';
import isFunction from 'lodash/isFunction';

export const unset = Symbol('reduxTools/unset');
export const noop = Symbol('reduxTools/noop');

const handleAction = (getHandlers) => (state, action) =>
  Object.entries(getHandlers(action, state) || {}).reduce((acc, [key, handler]) => {
    const updater = isFunction(handler) ? handler(action.payload, action.meta, action) : handler;
    const updated = isFunction(updater) ? updater(acc.get(key)) : updater;
    switch (updated) {
      case noop: return acc;
      case unset: return acc.remove(key);
      default: return acc.set(key, updated);
    }
  }, state);

export const handleActions = (handlers) =>
  handleAction(({ type }) => handlers[type]);

export const handleTransitions = (getState, handlers) =>
  handleAction(({ type }, state) => get(handlers, [getState(state), type]));

export const createActions = (scope, ...actions) =>
  actions.reduce((acc, action) => ({ ...acc, [action]: `${scope}/${action}` }), {});

export const withInitialState = (initialState, reducer) =>
  (state = initialState, action) => reducer(state, action);
