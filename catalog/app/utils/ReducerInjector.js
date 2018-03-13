import invariant from 'invariant';
import isEmpty from 'lodash/isEmpty';
import isFunction from 'lodash/isFunction';
import isString from 'lodash/isString';
import PT from 'prop-types';
import { Fragment } from 'react';
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


const scope = 'app/utils/ReducerInjector';

const isValidKey = (key) => isString(key) && !isEmpty(key);

export const createReducerRegistry = (onSet) => {
  const innerScope = `${scope}/createReducerRegistry`;
  invariant(isFunction(onSet),
    `${innerScope}: Expected 'onSet' to be a function`);

  let reducers = {};

  const get = () => reducers;

  const set = (key, reducer) => {
    const innerScope2 = `${scope}/ReducerRegistry/set`;
    invariant(isValidKey(key),
      `${innerScope2}: Expected 'key' to be a non-empty string`);
    invariant(isFunction(reducer),
      `${innerScope2}: Expected 'reducer' to be a function`);
    // Check `reducers[key] === reducer` for hot reloading when a key is the same but a reducer is different
    if (key in reducers && reducers[key] === reducer) return;

    onSet(reducers = { ...reducers, [key]: reducer });
  };

  return { get, set };
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

const withInitialState = (reducer, initialState) =>
  (state = initialState, action) => reducer(state, action);

const ownPropsKey = 'ownProps';

export const injectReducer = (key, reducer, initial) =>
  composeHOC(`injectReducer(${key})`,
    saveProps({ key: ownPropsKey }),
    getContext({
      reducerInjector: ReducerInjectorShape.isRequired,
    }),
    lifecycle({
      componentWillMount() {
        const newReducer = initial
          ? withInitialState(reducer, initial(this.props[ownPropsKey]))
          : reducer;
        this.props.reducerInjector.inject(key, newReducer);
      },
    }),
    restoreProps({ key: ownPropsKey }));
