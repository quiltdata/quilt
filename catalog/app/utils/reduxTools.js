import isFunction from 'lodash/isFunction';

const reduceHandlers = ({ payload, meta, ...rest }) => (state, [key, handler]) =>
  state.update(key, (val) => {
    if (!isFunction(handler)) return handler;
    const updater = handler(payload, meta, rest);
    return isFunction(updater) ? updater(val) : updater;
  });

export const composeHandlers = (initial, handlers) => (state = initial, action) =>
  action.type in handlers
    ? Object.entries(handlers[action.type]).reduce(reduceHandlers(action), state)
    : state;

export const createActions = (scope, ...actions) =>
  actions.reduce((acc, action) => ({ ...acc, [action]: `${scope}/${action}` }), {});
