import invariant from 'invariant';
import isEmpty from 'lodash/isEmpty';
import isFunction from 'lodash/isFunction';
import isString from 'lodash/isString';
import PT from 'prop-types';
import React, { Fragment } from 'react';
import {
  lifecycle,
  setPropTypes,
  getContext,
  withContext,
} from 'recompose';

import {
  composeComponent,
  composeHOC,
  restoreProps,
  saveProps,
} from 'utils/reactTools';
import { withInitialState } from 'utils/reduxTools';


const scope = 'app/utils/ReducerInjector';

const isValidKey = (key) => isString(key) && !isEmpty(key);

/**
 * Create a reducer injector function.
 *
 * @param {function} onSet
 *   Callback that gets called with the injected reducer map when it gets updated
 *   (a new reducer injected).
 *
 * @returns {function}
 *   A reducer injector function.
 *   Takes a key (mountpoint) and a reducer.
 */
export const createReducerInjector = (onSet) => {
  const innerScope = `${scope}/createReducerInjector`;
  invariant(isFunction(onSet),
    `${innerScope}: Expected 'onSet' to be a function`);

  let reducers = {};

  return (key, reducer) => {
    const innerScope2 = `${scope}/injectReducer`;
    invariant(isValidKey(key),
      `${innerScope2}: Expected 'key' to be a non-empty string`);
    invariant(isFunction(reducer),
      `${innerScope2}: Expected 'reducer' to be a function`);
    // Check `reducers[key] === reducer` for hot reloading
    // when a key is the same but a reducer is different
    if (key in reducers && reducers[key] === reducer) return;

    onSet(reducers = { ...reducers, [key]: reducer });
  };
};

const ReducerInjectorShape = PT.shape({
  inject: PT.func.isRequired,
});

/**
 * Provider component for reducer injection system.
 */
export const ReducerInjector = composeComponent('ReducerInjector',
  setPropTypes({
    /**
     * A reducer injector function.
     */
    inject: PT.func.isRequired,
  }),
  saveProps({ keep: ['inject'] }),
  withContext(
    { reducerInjector: ReducerInjectorShape.isRequired },
    ({ inject }) => ({ reducerInjector: { inject } }),
  ),
  restoreProps(),
  Fragment);

/**
 * Component that injects a given reducer into the store on mount.
 */
export const InjectReducer = composeComponent('InjectReducer',
  setPropTypes({
    /**
     * A key under which the reducer gets injected.
     */
    mount: PT.string.isRequired,
    /**
     * A reducer that gets injected.
     */
    reducer: PT.func.isRequired,
  }),
  saveProps({ keep: ['mount', 'reducer'] }),
  getContext({
    reducerInjector: ReducerInjectorShape.isRequired,
  }),
  lifecycle({
    componentWillMount() {
      this.props.reducerInjector.inject(this.props.mount, this.props.reducer);
    },
  }),
  restoreProps(),
  Fragment);


/**
 * Create a HOC that injects a given reducer into the store on mount.
 * InjectReducer component is used under the hood.
 *
 * @param {string} mount
 *   A key under which the reducer gets injected.
 *
 * @param {reduxTools.Reducer} reducer
 *
 * @param {function} initial
 *   A function to populate the reducer's initial state.
 *   Gets called with the props passed to the resulting component.
 *
 * @returns {reactTools.HOC}
 */
export const injectReducer = (mount, reducer, initial) =>
  composeHOC(`injectReducer(${mount})`, (Component) => (props) => (
    <InjectReducer
      mount={mount}
      reducer={initial ? withInitialState(initial(props), reducer) : reducer}
    >
      <Component {...props} />
    </InjectReducer>
  ));

/**
 * Create a store enhancer that attaches `injectReducer` method to the store.
 *
 * @param {function} createReducer
 *   A function that creates a reducer from the given reducer map.
 *
 * @returns {reduxTools.StoreEnhancer}
 */
export const withInjectableReducers = (createReducer) => (createStore) => (...args) => {
  const store = createStore(...args);
  const inject = createReducerInjector((injected) => {
    store.replaceReducer(createReducer(injected));
  });
  return {
    ...store,
    injectReducer: inject,
  };
};
