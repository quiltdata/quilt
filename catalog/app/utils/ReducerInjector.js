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
    // Check `reducers[key] === reducer` for hot reloading when a key is the same but a reducer is different
    if (key in reducers && reducers[key] === reducer) return;

    onSet(reducers = { ...reducers, [key]: reducer });
  };
};

const ReducerInjectorShape = PT.shape({
  inject: PT.func.isRequired,
});

export const ReducerInjector = composeComponent('ReducerInjector',
  setPropTypes({
    inject: PT.func.isRequired,
  }),
  saveProps({ keep: ['inject'] }),
  withContext(
    { reducerInjector: ReducerInjectorShape.isRequired },
    ({ inject }) => ({ reducerInjector: { inject } }),
  ),
  restoreProps(),
  Fragment);

export const InjectReducer = composeComponent('InjectReducer',
  setPropTypes({
    mount: PT.string.isRequired,
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


export const injectReducer = (mount, reducer, initial) =>
  composeHOC(`injectReducer(${mount})`, (Component) => (props) => (
    <InjectReducer
      mount={mount}
      reducer={initial ? withInitialState(initial(props), reducer) : reducer}
    >
      <Component {...props} />
    </InjectReducer>
  ));

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
