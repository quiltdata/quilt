import { fromJS, Iterable } from 'immutable'
import * as React from 'react'
import { Provider as ReduxProvider } from 'react-redux'
import { createStore, applyMiddleware, compose } from 'redux'
import { composeWithDevTools } from 'redux-devtools-extension'
import { combineReducers } from 'redux-immutable'
import * as Sentry from '@sentry/react'

import { withInjectableReducers } from 'utils/ReducerInjector'
import { withSaga } from 'utils/SagaInjector'

const stateTransformer = (state) =>
  // pure JS is easier to read than Immutable objects
  Iterable.isIterable(state) ? state.toJS() : state

const actionTransformer = (action) => {
  switch (action.type) {
    case 'app/Auth/SIGN_UP':
    case 'app/Auth/SIGN_IN':
    case 'app/Auth/CHANGE_PASSWORD':
      return {
        ...action,
        payload: {
          ...action.payload,
          password: '***',
        },
      }
  }
  return action
}

const composeEnhancers = composeWithDevTools({})

const sentryEnhancer = Sentry.createReduxEnhancer({ actionTransformer, stateTransformer })

const sentryfyReducer = (originalReducer) => {
  let extracted
  const extractReducer = (reducer) => {
    extracted = reducer
  }
  sentryEnhancer(extractReducer)(originalReducer, {})
  return extracted
}

const createReducer = compose(sentryfyReducer, combineReducers)

export const Provider = function StoreProvider({ initialState = {}, children }) {
  // Create the store with asynchronously loaded reducers
  const [store] = React.useState(() => {
    const middlewares = []
    // log redux state in development
    if (
      process.env.NODE_ENV === 'development' &&
      process.env.LOGGER_REDUX === 'enabled'
    ) {
      // eslint-disable-next-line global-require
      const { createLogger } = require('redux-logger')
      middlewares.push(createLogger({ stateTransformer, collapsed: true }))
    }

    return createStore(
      (state) => state, // noop reducer, the actual ones will be injected
      fromJS(initialState),
      composeEnhancers(
        withSaga({ onError: Sentry.captureException }),
        applyMiddleware(...middlewares),
        withInjectableReducers(createReducer),
      ),
    )
  })

  return <ReduxProvider store={store}>{children}</ReduxProvider>
}
