import invariant from 'invariant'
import isFunction from 'lodash/isFunction'
import * as React from 'react'
import * as redux from 'react-redux'
import { applyMiddleware } from 'redux'
import createSagaMiddleware from 'redux-saga'

const scope = 'app/utils/SagaInjector'

export const useSaga = (saga, ...args) => {
  const innerScope = `${scope}/SagaInjector/useSaga`
  invariant(isFunction(saga), `${innerScope}: Expected 'saga' to be a function`)

  const { runSaga } = redux.useStore()
  const running = React.useRef()

  if (running.current && running.current.saga !== saga) {
    running.current.task.cancel()
    running.current = null
  }

  if (!running.current) {
    const task = runSaga(saga, ...args)
    running.current = { saga, task }
  }

  React.useEffect(
    () => () => {
      if (running.current) running.current.task.cancel()
    },
    [],
  )

  return running.current.task
}

// saga: any => any, args: any[]
export function Inject({ saga, args = [], children }) {
  useSaga(saga, ...args)
  return children
}

export const withSaga =
  (...sagaMWArgs) =>
  (createStore) =>
  (...args) => {
    const sagaMiddleware = createSagaMiddleware(...sagaMWArgs)
    const store = applyMiddleware(sagaMiddleware)(createStore)(...args)
    return {
      ...store,
      runSaga: sagaMiddleware.run,
    }
  }
