/* Create the store with asynchronously loaded reducers */
import { createStore, applyMiddleware, compose } from 'redux';
import { Iterable } from 'immutable';
import { routerMiddleware } from 'react-router-redux';
import createSagaMiddleware from 'redux-saga';

import { createReducerRegistry } from 'utils/ReducerInjector';

import createReducer from './reducers';

const sagaMiddleware = createSagaMiddleware();
// eslint-disable-next-line no-unused-vars
export default function configureStore(initialState = {}, history) {
  // sagaMiddleware: Makes redux-sagas work
  // routerMiddleware: Syncs the location/URL path to the state
  const middlewares = [
    sagaMiddleware,
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

  const enhancers = [
    applyMiddleware(...middlewares),
  ];

  // If Redux DevTools Extension is installed use it, otherwise use Redux compose
  /* eslint-disable no-underscore-dangle */
  const composeEnhancers =
    process.env.NODE_ENV !== 'production' &&
    typeof window === 'object' &&
    window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ ?
      window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ : compose;
  /* eslint-enable */

  const store = createStore(
    createReducer(),
    composeEnhancers(...enhancers)
  );

  const reducerRegistry = createReducerRegistry((injected) => {
    console.log('reducers injected', injected);
    store.replaceReducer(createReducer(injected));
  });

  // Extensions
  store.runSaga = sagaMiddleware.run;
  store.injectReducer = reducerRegistry.set;
  // Make reducers hot reloadable, see http://mxs.is/googmo
  /* istanbul ignore next */
  if (module.hot) {
    module.hot.accept('./reducers', () => {
      store.replaceReducer(createReducer(reducerRegistry.get()));
    });
  }
  return store;
}
