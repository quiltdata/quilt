import { fromJS, Iterable } from 'immutable'
import * as React from 'react'
import { Provider as ReduxProvider } from 'react-redux'
import { createStore, applyMiddleware, compose, Reducer } from 'redux'
import { composeWithDevTools } from 'redux-devtools-extension'
import { combineReducers } from 'redux-immutable'
import * as Sentry from '@sentry/react'

import { withInjectableReducers } from 'utils/ReducerInjector'
import { withSaga } from 'utils/SagaInjector'

const stateTransformer = (state: any) =>
  // pure JS is easier to read than Immutable objects
  Iterable.isIterable(state) ? state.toJS() : state

interface AnyAction {
  type: string
  payload?: any
  [key: string]: any
}

const actionTransformer = (action: AnyAction) => {
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

const sentryfyReducer = (originalReducer: Reducer) => {
  let extracted: Reducer | undefined
  const extractReducer = (reducer: Reducer) => {
    extracted = reducer
  }
  sentryEnhancer(extractReducer)(originalReducer, {})
  return extracted
}

const createReducer = compose(sentryfyReducer, combineReducers)

interface ProviderProps {
  initialState?: object
  children: React.ReactNode
}

export const Provider = function StoreProvider({
  initialState = {},
  children,
}: ProviderProps) {
  // Create the store with asynchronously loaded reducers
  const [store] = React.useState(() => {
    const middlewares: any[] = []
    // log redux state in development
    if (
      process.env.NODE_ENV === 'development' &&
      process.env.LOGGER_REDUX === 'enabled'
    ) {
      // eslint-disable-next-line global-require
      const { createLogger } = require('redux-logger')
      middlewares.push(createLogger({ stateTransformer, collapsed: true }))
    }

    // redux's createStore generics don't model the Immutable preloaded state +
    // custom enhancers (injectable reducers / saga); call through a cast.
    return (createStore as any)(
      (state: any) => state, // noop reducer, the actual ones will be injected
      fromJS(initialState),
      composeEnhancers(
        withSaga({ onError: Sentry.captureException }),
        applyMiddleware(...middlewares),
        withInjectableReducers(createReducer as (reducers: Record<string, any>) => any),
      ),
    )
  })

  return <ReduxProvider store={store}>{children}</ReduxProvider>
}
