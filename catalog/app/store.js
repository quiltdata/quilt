/* Create the store with asynchronously loaded reducers */
import { createStore, applyMiddleware, compose } from 'redux';
import { Iterable } from 'immutable';
import { routerMiddleware } from 'react-router-redux';
import createSagaMiddleware from 'redux-saga';

import { getAsyncInjectors } from 'utils/asyncInjectors';
import appSagas from 'containers/App/sagas';
import gallerySagas from 'containers/Gallery/sagas';
import searchSagas from 'containers/SearchResults/sagas';
import { loadState } from 'utils/storage';

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
    loadState(),
    composeEnhancers(...enhancers)
  );
  // Extensions
  store.runSaga = sagaMiddleware.run;
  store.asyncReducers = {}; // Async reducer registry
  const { injectSagas } = getAsyncInjectors(store);
  // App sagas injected by hand since this is not done in routes.js
  // since App is not a direct route handling component
  injectSagas(appSagas);
  // Because we dispatch GET_SEARCH on LOCATION_CHANGE or ROUTER_START
  // we cannot hot load the search sagas in routes.js since they may not be
  // ready when the event fires, causing the event to drop
  injectSagas(searchSagas);
  // Gallery occurs at multiple routes so inject here instead of routes.js
  injectSagas(gallerySagas);
  // Make reducers hot reloadable, see http://mxs.is/googmo
  /* istanbul ignore next */
  if (module.hot) {
    module.hot.accept('./reducers', () => {
      store.replaceReducer(createReducer(store.asyncReducers));
    });
  }
  return store;
}
