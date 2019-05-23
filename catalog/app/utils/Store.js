import { routerMiddleware } from 'connected-react-router/immutable'
import { fromJS, Iterable } from 'immutable'
import PT from 'prop-types'
import * as React from 'react'
import { Provider as ReduxProvider } from 'react-redux'
import { setPropTypes } from 'recompose'
import { createStore, applyMiddleware } from 'redux'
import { composeWithDevTools } from 'redux-devtools-extension'
import { combineReducers } from 'redux-immutable'
import { StoreContext } from 'redux-react-hook'

import { withInjectableReducers } from 'utils/ReducerInjector'
import { withSaga } from 'utils/SagaInjector'
import * as Sentry from 'utils/Sentry'
import { composeComponent } from 'utils/reactTools'

export { StoreContext as Ctx }

export const Provider = composeComponent(
  'Store.Provider',
  setPropTypes({
    initialState: PT.object,
    history: PT.object.isRequired,
  }),
  ({ initialState = {}, history, children }) => {
    const sentry = Sentry.use()

    // Create the store with asynchronously loaded reducers
    const [store] = React.useState(() => {
      // routerMiddleware: Syncs the location/URL path to the state
      const middlewares = [routerMiddleware(history)]
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

    return (
      <ReduxProvider store={store}>
        <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
      </ReduxProvider>
    )
  },
)

export const useStore = () => React.useContext(StoreContext)

export const use = useStore
