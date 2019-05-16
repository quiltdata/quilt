import * as I from 'immutable'
import * as R from 'ramda'
import * as React from 'react'
import * as reduxHook from 'redux-react-hook'
import * as effects from 'redux-saga/effects'
import uuid from 'uuid'

import AsyncResult from 'utils/AsyncResult'
import { useReducer } from 'utils/ReducerInjector'
import { useSaga } from 'utils/SagaInjector'
import defer from 'utils/defer'
import * as reduxTools from 'utils/reduxTools'
import * as sagaTools from 'utils/sagaTools'
import tagged from 'utils/tagged'

const REDUX_KEY = 'app/ResourceCache'

const Ctx = React.createContext()

// Resource<I, O> = {
//   name: string,
//   id: string,
//   fetch<I, O>: I -> Promise<O>,
// }
//
// Entry<O> = {
//   promise: Promise<O>,
//   result: AsyncResult<{
//     Init: void
//     Pending: void
//     Err: any
//     Ok: O
//   }),
// }
// State = Map<string, Map<I, Entry<O>>>

export const createResource = ({ name, fetch, key = R.identity }) => ({
  name,
  fetch,
  id: uuid(),
  key,
})

const Action = tagged([
  'Init', // { resource, input: any, promise, resolver }
  'Request', // { resource, input: any }
  'Response', // { resource, input: any, result: Result }
  'Patch', // { resource, input: any, update: fn }
  // TODO
  // 'Dispose', // { fetch: fn, input: any }
])

const keyFor = (resource, input) => [resource.id, I.fromJS(resource.key(input))]

const reducer = reduxTools.withInitialState(
  I.Map(),
  Action.reducer({
    Init: ({ resource, input, promise }) => (s) =>
      s.updateIn(keyFor(resource, input), (entry) => {
        if (entry) throw new Error('Init: entry already exists')
        return { promise, result: AsyncResult.Init() }
      }),
    Request: ({ resource, input }) => (s) =>
      s.updateIn(keyFor(resource, input), (entry) => {
        if (!entry) throw new Error('Request: entry does not exist')
        if (!AsyncResult.Init.is(entry.result)) {
          throw new Error('Request: invalid transition')
        }
        return { ...entry, result: AsyncResult.Pending() }
      }),
    Response: ({ resource, input, result }) => (s) =>
      s.updateIn(keyFor(resource, input), (entry) => {
        if (!entry) throw new Error('Response: entry does not exist')
        if (!AsyncResult.Pending.is(entry.result)) {
          throw new Error('Response: invalid transition')
        }
        return { ...entry, result }
      }),
    Patch: ({ resource, input, update }) => (s) =>
      s.updateIn(keyFor(resource, input), (entry) => {
        if (!entry) throw new Error('Patch: entry does not exist')
        return update(entry)
      }),
    __: () => R.identity,
  }),
)

const selectEntry = (resource, input) => (s) =>
  s.getIn([REDUX_KEY, ...keyFor(resource, input)])

function* handleInit({ resource, input, resolver }) {
  yield effects.put(Action.Request({ resource, input }))
  try {
    const res = yield effects.call(resource.fetch, input)
    yield effects.put(Action.Response({ resource, input, result: AsyncResult.Ok(res) }))
    resolver.resolve(res)
  } catch (e) {
    yield effects.put(Action.Response({ resource, input, result: AsyncResult.Err(e) }))
    resolver.reject(e)
  }
}

function* saga() {
  yield sagaTools.takeEveryTagged(Action.Init, handleInit)
}

export const suspend = ({ promise, result }) =>
  AsyncResult.case(
    {
      Init: () => {
        throw promise
      },
      Pending: () => {
        throw promise
      },
      Err: (e) => {
        throw e
      },
      Ok: R.identity,
    },
    result,
  )

export const Provider = ({ children }) => {
  useSaga(saga)
  useReducer(REDUX_KEY, reducer)
  const store = React.useContext(reduxHook.StoreContext)
  const accessResult = React.useCallback(
    (resource, input) => {
      const getEntry = () => selectEntry(resource, input)(store.getState())
      const entry = getEntry()
      if (entry) return entry
      store.dispatch(Action.Init({ resource, input, ...defer() }))
      return getEntry()
    },
    [store],
  )

  const get = React.useCallback(
    R.pipe(
      accessResult,
      suspend,
    ),
    [accessResult],
  )

  const patch = React.useCallback(
    (resource, input, update) => {
      store.dispatch(Action.Patch({ resource, input, update }))
    },
    [store],
  )

  const patchOk = React.useCallback(
    (resource, input, updateOk) => {
      const update = R.when(
        (s) => AsyncResult.Ok.is(s.result),
        R.evolve({
          result: AsyncResult.case({
            Ok: R.pipe(
              updateOk,
              AsyncResult.Ok,
            ),
            _: R.identity,
          }),
          promise: R.then(updateOk),
        }),
      )
      return patch(resource, input, update)
    },
    [patch],
  )

  const inst = { access: accessResult, get, patch, patchOk }

  return <Ctx.Provider value={inst}>{children}</Ctx.Provider>
}

export const useResourceCache = () => React.useContext(Ctx)

export const use = useResourceCache

// TODO: claim / release in useEffect
export const useData = (resource, input, opts = {}) => {
  const cache = use()
  const get = React.useCallback(() => cache.access(resource, input), [
    cache,
    resource,
    input,
  ])
  const [entry, setEntry] = React.useState(get())
  const store = React.useContext(reduxHook.StoreContext)
  React.useEffect(
    () =>
      store.subscribe(() => {
        const newEntry = get()
        if (!R.equals(newEntry, entry)) {
          setEntry(newEntry)
        }
      }),
    [store, get],
  )

  return opts.suspend ? suspend(entry) : entry
}
