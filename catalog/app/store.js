/* Create the store with asynchronously loaded reducers */
import { createStore, applyMiddleware, compose } from 'redux';
import { fromJS, Iterable } from 'immutable';
import { routerMiddleware } from 'react-router-redux';
import { combineReducers } from 'redux-immutable';

import { captureError } from 'utils/errorReporting';
import { withInjectableReducers } from 'utils/ReducerInjector';
import { withSaga } from 'utils/SagaInjector';

export default function configureStore(initialState = {}, history) {
  // routerMiddleware: Syncs the location/URL path to the state
  const middlewares = [
    routerMiddleware(history),
  ];
  // log redux state in development
  if (process.env.NODE_ENV === 'development') {
    const stateTransformer = (state) => (
      // pure JS is easier to read than Immutable objects
      Iterable.isIterable(state) ? state.toJS() : state
    );
    const { createLogger } = require('redux-logger'); // eslint-disable-line global-require
    middlewares.push(createLogger({ stateTransformer }));
  }

  // If Redux DevTools Extension is installed use it, otherwise use Redux compose
  /* eslint-disable no-underscore-dangle */
  const composeEnhancers =
    process.env.NODE_ENV !== 'production' &&
    typeof window === 'object' &&
    window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__
      ? window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__({
        // TODO Try to remove when `react-router-redux` is out of beta, LOCATION_CHANGE should not be fired more than once after hot reloading
        // Prevent recomputing reducers for `replaceReducer`
        shouldHotReload: false,
      })
      : compose;
  /* eslint-enable */

  return createStore(
    (state) => state, // noop reducer, the actual ones will be injected
    fromJS(initialState),
    composeEnhancers(
      withSaga({ onError: captureError }),
      applyMiddleware(...middlewares),
      withInjectableReducers(combineReducers),
    )
  );
}
