import invariant from 'invariant'
import isFunction from 'lodash/isFunction'
import PT from 'prop-types'
import * as React from 'react'
import * as RC from 'recompose'
import { applyMiddleware } from 'redux'
import { StoreContext } from 'redux-react-hook'
import createSagaMiddleware from 'redux-saga'

import * as RT from 'utils/reactTools'

const scope = 'app/utils/SagaInjector'

export const useSaga = (saga, ...args) => {
  const innerScope = `${scope}/SagaInjector/useSaga`
  invariant(isFunction(saga), `${innerScope}: Expected 'saga' to be a function`)

  const { runSaga } = React.useContext(StoreContext)
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

export const Inject = RT.composeComponent(
  'SagaInjector.Inject',
  RC.setPropTypes({
    saga: PT.func.isRequired,
    args: PT.array,
  }),
  ({ saga, args = [], children }) => {
    useSaga(saga, ...args)
    return children
  },
)

export const injectSaga = (name, saga, { args = (props) => [props] } = {}) =>
  RT.composeHOC(
    `injectSaga(${name})`,
    RT.wrap(Inject, (props) => ({ saga, args: args(props) })),
  )

export const withSaga = (...sagaMWArgs) => (createStore) => (...args) => {
  const sagaMiddleware = createSagaMiddleware(...sagaMWArgs)
  const store = applyMiddleware(sagaMiddleware)(createStore)(...args)
  return {
    ...store,
    runSaga: sagaMiddleware.run,
  }
}
