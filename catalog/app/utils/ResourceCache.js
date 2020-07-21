import * as I from 'immutable'
import * as R from 'ramda'
import * as React from 'react'
import * as redux from 'react-redux'
import * as effects from 'redux-saga/effects'
import uuid from 'uuid'

import AsyncResult from 'utils/AsyncResult'
import { useReducer } from 'utils/ReducerInjector'
import { useSaga } from 'utils/SagaInjector'
import defer from 'utils/defer'
import * as reduxTools from 'utils/reduxTools'
import * as sagaTools from 'utils/sagaTools'
import tagged from 'utils/tagged'
import useMemoEq from 'utils/useMemoEq'

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
//   claimed: number,
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
  'Patch', // { resource, input: any, update: fn, silent: bool }
  'Claim', // { resource, input: any }
  'Release', // { resource, input: any }
])

const keyFor = (resource, input) => [resource.id, I.fromJS(resource.key(input))]

const reducer = reduxTools.withInitialState(
  I.Map(),
  Action.reducer({
    Init: ({ resource, input, promise }) => (s) =>
      s.updateIn(keyFor(resource, input), (entry) => {
        if (entry) throw new Error('Init: entry already exists')
        return { promise, result: AsyncResult.Init(), claimed: 0 }
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
        if (!entry) return undefined // released before response
        if (!AsyncResult.Pending.is(entry.result)) {
          throw new Error('Response: invalid transition')
        }
        return { ...entry, result }
      }),
    Patch: ({ resource, input, update, silent = false }) => (s) =>
      s.updateIn(keyFor(resource, input), (entry) => {
        if (!entry) {
          if (silent) return entry
          throw new Error('Patch: entry does not exist')
        }
        return update(entry)
      }),
    Claim: ({ resource, input }) => (s) =>
      s.updateIn(keyFor(resource, input), (entry) => {
        if (!entry) throw new Error('Claim: entry does not exist')
        return { ...entry, claimed: entry.claimed + 1 }
      }),
    Release: ({ resource, input }) => (s) => {
      const key = keyFor(resource, input)
      const entry = s.getIn(key)
      if (!entry) throw new Error('Release: entry does not exist')
      return entry.claimed <= 1
        ? s.removeIn(key)
        : s.updateIn(key, R.evolve({ claimed: R.dec }))
    },
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

export const Provider = function ResourceCacheProvider({ children }) {
  useSaga(saga)
  useReducer(REDUX_KEY, reducer)
  const store = redux.useStore()
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

  const get = React.useCallback(R.pipe(accessResult, suspend), [accessResult])

  const patch = React.useCallback(
    (resource, input, update, silent) => {
      store.dispatch(Action.Patch({ resource, input, update, silent }))
    },
    [store],
  )

  const patchOk = React.useCallback(
    (resource, input, updateOk, silent) => {
      const update = R.when(
        (s) => AsyncResult.Ok.is(s.result),
        R.evolve({
          result: AsyncResult.case({
            Ok: R.pipe(updateOk, AsyncResult.Ok),
            _: R.identity,
          }),
          promise: R.then(updateOk),
        }),
      )
      return patch(resource, input, update, silent)
    },
    [patch],
  )

  const claim = React.useCallback(
    (resource, input) => {
      store.dispatch(Action.Claim({ resource, input }))
    },
    [store],
  )

  const release = React.useCallback(
    (resource, input) => {
      store.dispatch(Action.Release({ resource, input }))
    },
    [store],
  )

  const inst = { access: accessResult, get, patch, patchOk, claim, release }

  return <Ctx.Provider value={inst}>{children}</Ctx.Provider>
}

export function useResourceCache() {
  return React.useContext(Ctx)
}

export const use = useResourceCache

export function useData(resource, input, opts = {}) {
  const cache = use()
  const get = useMemoEq({ cache, resource, input }, (args) => () =>
    args.cache.access(args.resource, args.input),
  )
  const [entry, setEntry] = React.useState(get)
  const store = redux.useStore()
  React.useEffect(() => {
    let prevEntry = get()
    cache.claim(resource, input)
    const unsubscribe = store.subscribe(() => {
      const newEntry = get()
      if (!R.equals(newEntry, prevEntry)) {
        setEntry(newEntry)
        prevEntry = newEntry
      }
    })
    return () => {
      unsubscribe()
      cache.release(resource, input)
    }
  }, [store, get])

  return opts.suspend ? suspend(entry) : entry
}
