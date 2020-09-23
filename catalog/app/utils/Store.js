import { routerMiddleware } from 'connected-react-router/esm/immutable'
import { fromJS, Iterable } from 'immutable'
import * as React from 'react'
import { Provider as ReduxProvider } from 'react-redux'
import { createStore, applyMiddleware } from 'redux'
import { composeWithDevTools } from 'redux-devtools-extension'
import { combineReducers } from 'redux-immutable'

import { withInjectableReducers } from 'utils/ReducerInjector'
import { withSaga } from 'utils/SagaInjector'
import * as Sentry from 'utils/Sentry'

export const Provider = function StoreProvider({ initialState = {}, history, children }) {
  const sentry = Sentry.use()

  // Create the store with asynchronously loaded reducers
  const [store] = React.useState(() => {
    const middlewares = []
    if (history) {
      // routerMiddleware: Syncs the location/URL path to the state
      middlewares.push(routerMiddleware(history))
    }
    // log redux state in development
    if (process.env.NODE_ENV === 'development') {
      const stateTransformer = (state) =>
        // pure JS is easier to read than Immutable objects
        Iterable.isIterable(state) ? state.toJS() : state
      // eslint-disable-next-line global-require
      const { createLogger } = require('redux-logger')
      middlewares.push(createLogger({ stateTransformer, collapsed: true }))
    }

    const composeEnhancers = composeWithDevTools({})

    const captureError = (e) => sentry('captureException', e)

    return createStore(
      (state) => state, // noop reducer, the actual ones will be injected
      fromJS(initialState),
      composeEnhancers(
        withSaga({ onError: captureError }),
        applyMiddleware(...middlewares),
        withInjectableReducers(combineReducers),
      ),
    )
  })

  return <ReduxProvider store={store}>{children}</ReduxProvider>
}
