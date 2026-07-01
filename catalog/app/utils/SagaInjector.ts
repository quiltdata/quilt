import invariant from 'invariant'
import isFunction from 'lodash/isFunction'
import * as React from 'react'
import * as redux from 'react-redux'
import { applyMiddleware } from 'redux'
import createSagaMiddleware from 'redux-saga'
import type { Saga, Task } from 'redux-saga'

const scope = 'app/utils/SagaInjector'

interface SagaStore {
  runSaga: (saga: Saga, ...args: any[]) => Task
}

export const useSaga = (saga: Saga, ...args: any[]): Task => {
  const innerScope = `${scope}/SagaInjector/useSaga`
  invariant(isFunction(saga), `${innerScope}: Expected 'saga' to be a function`)

  const { runSaga } = redux.useStore() as unknown as SagaStore
  const running = React.useRef<{ saga: Saga; task: Task } | null>(null)

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

interface InjectProps {
  saga: Saga
  args?: any[]
  children: React.ReactNode
}

export function Inject({ saga, args = [], children }: InjectProps) {
  useSaga(saga, ...args)
  return children
}

export const withSaga =
  (...sagaMWArgs: any[]) =>
  (createStore: (...args: any[]) => any) =>
  (...args: any[]) => {
    const sagaMiddleware = (
      createSagaMiddleware as (...a: any[]) => ReturnType<typeof createSagaMiddleware>
    )(...sagaMWArgs)
    const store = (applyMiddleware(sagaMiddleware)(createStore) as (...a: any[]) => any)(
      ...args,
    )
    return {
      ...store,
      runSaga: sagaMiddleware.run,
    }
  }
