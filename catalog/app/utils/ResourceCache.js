import * as I from 'immutable'
import * as R from 'ramda'
import * as React from 'react'
import * as redux from 'react-redux'
import * as effects from 'redux-saga/effects'
import * as uuid from 'uuid'

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

const RELEASE_TIME = 5000

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
//   releasedAt: Date?
// }
// State = Map<string, Map<I, Entry<O>>>

export const createResource = ({ name, fetch, key = R.identity, persist = false }) => ({
  name,
  fetch,
  id: uuid.v4(),
  key,
  persist,
})

const Action = tagged([
  'Init', // { resource, input: any, promise, resolver }
  'Request', // { resource, input: any }
  'Response', // { resource, input: any, result: Result }
  'Patch', // { resource, input: any, update: fn, silent: bool }
  'Claim', // { resource, input: any }
  'Release', // { resource, input: any, releasedAt: Date }
  'CleanUp', // { time: Date }
])

const keyFor = (resource, input) => [resource.id, I.fromJS(resource.key(input))]

const reducer = reduxTools.withInitialState(
  I.Map(),
  Action.reducer({
    Init:
      ({ resource, input, promise }) =>
      (s) =>
        s.updateIn(keyFor(resource, input), (entry) => {
          if (entry) throw new Error('Init: entry already exists')
          return {
            promise,
            result: AsyncResult.Init(),
            claimed: resource.persist ? 1 : 0, // "persistent" resources won't be released
          }
        }),
    Request:
      ({ resource, input }) =>
      (s) =>
        s.updateIn(keyFor(resource, input), (entry) => {
          if (!entry) throw new Error('Request: entry does not exist')
          if (!AsyncResult.Init.is(entry.result)) {
            throw new Error('Request: invalid transition')
          }
          return { ...entry, result: AsyncResult.Pending() }
        }),
    Response:
      ({ resource, input, result }) =>
      (s) =>
        s.updateIn(keyFor(resource, input), (entry) => {
          if (!entry) return undefined // released before response
          if (!AsyncResult.Pending.is(entry.result)) {
            throw new Error('Response: invalid transition')
          }
          return { ...entry, result }
        }),
    Patch:
      ({ resource, input, update, silent = false }) =>
      (s) =>
        s.updateIn(keyFor(resource, input), (entry) => {
          if (!entry) {
            if (silent) return entry
            throw new Error('Patch: entry does not exist')
          }
          return update(entry)
        }),
    Claim:
      ({ resource, input }) =>
      (s) =>
        s.updateIn(keyFor(resource, input), (entry) => {
          if (!entry) throw new Error('Claim: entry does not exist')
          return { ...entry, claimed: entry.claimed + 1 }
        }),
    Release:
      ({ resource, input, releasedAt }) =>
      (s) =>
        s.updateIn(keyFor(resource, input), (entry) => {
          if (!entry) throw new Error('Release: entry does not exist')
          return { ...entry, claimed: entry.claimed - 1, releasedAt }
        }),
    CleanUp:
      ({ time }) =>
      (s) =>
        s.map((r) =>
          r.filter(
            (entry) =>
              entry.claimed >= 1 ||
              !entry.releasedAt ||
              time - entry.releasedAt < RELEASE_TIME,
          ),
        ),
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

function* cleanup() {
  while (true) {
    yield effects.delay(RELEASE_TIME)
    yield effects.put(Action.CleanUp({ time: new Date() }))
  }
}

function* saga() {
  yield sagaTools.takeEveryTagged(Action.Init, handleInit)
  yield effects.fork(cleanup)
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

  const get = React.useMemo(() => R.pipe(accessResult, suspend), [accessResult])

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
          promise: R.andThen(updateOk),
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
      const releasedAt = new Date()
      store.dispatch(Action.Release({ resource, input, releasedAt }))
    },
    [store],
  )

  const inst = React.useMemo(
    () => ({ access: accessResult, get, patch, patchOk, claim, release }),
    [accessResult, get, patch, patchOk, claim, release],
  )

  return <Ctx.Provider value={inst}>{children}</Ctx.Provider>
}

export function useResourceCache() {
  return React.useContext(Ctx)
}

export const use = useResourceCache

export function useData(resource, input, opts = {}) {
  const cache = use()
  const inputMemo = useMemoEq(input, R.identity)
  const [entry, setEntry] = React.useState(() => cache.access(resource, input))
  const store = redux.useStore()
  React.useEffect(() => {
    let prevEntry = cache.access(resource, inputMemo)
    cache.claim(resource, inputMemo)
    const unsubscribe = store.subscribe(() => {
      const newEntry = cache.access(resource, inputMemo)
      if (!R.equals(newEntry, prevEntry)) {
        setEntry(newEntry)
        prevEntry = newEntry
      }
    })
    return () => {
      unsubscribe()
      cache.release(resource, inputMemo)
    }
  }, [store, cache, resource, inputMemo])

  return opts.suspend ? suspend(entry) : entry
}
