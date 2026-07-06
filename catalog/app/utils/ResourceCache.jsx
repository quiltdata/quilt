import * as I from 'immutable'
import * as R from 'ramda'
import * as React from 'react'
import * as redux from 'redux'
import * as uuid from 'uuid'

import AsyncResult from 'utils/AsyncResult'
import defer from 'utils/defer'
import * as reduxTools from 'utils/reduxTools'
import tagged from 'utils/tagged'
import useConstant from 'utils/useConstant'
import useMemoEq from 'utils/useMemoEq'

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
  const { dispatch, subscribe, getState } = useConstant(() => redux.createStore(reducer))

  const getEntry = React.useCallback(
    (resource, input) => getState().getIn(keyFor(resource, input)),
    [getState],
  )

  const init = React.useCallback(
    (resource, input) => {
      const { resolver, promise } = defer()
      dispatch(Action.Init({ resource, input, resolver, promise }))
      setTimeout(() => {
        dispatch(Action.Request({ resource, input }))
        resource.fetch(input).then(
          (res) => {
            dispatch(Action.Response({ resource, input, result: AsyncResult.Ok(res) }))
            resolver.resolve(res)
          },
          (e) => {
            dispatch(Action.Response({ resource, input, result: AsyncResult.Err(e) }))
            resolver.reject(e)
          },
        )
      }, 0)
      return getEntry(resource, input)
    },
    [dispatch, getEntry],
  )

  const access = React.useCallback(
    (resource, input) => getEntry(resource, input) ?? init(resource, input),
    [getEntry, init],
  )

  const get = React.useMemo(() => R.pipe(access, suspend), [access])

  const patch = React.useCallback(
    (resource, input, update, silent) => {
      dispatch(Action.Patch({ resource, input, update, silent }))
    },
    [dispatch],
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
      dispatch(Action.Claim({ resource, input }))
    },
    [dispatch],
  )

  const release = React.useCallback(
    (resource, input) => {
      const releasedAt = new Date()
      dispatch(Action.Release({ resource, input, releasedAt }))
    },
    [dispatch],
  )

  const inst = React.useMemo(
    () => ({ access, get, patch, patchOk, claim, release, subscribe }),
    [access, get, patch, patchOk, claim, release, subscribe],
  )

  const cleanup = React.useCallback(
    () => dispatch(Action.CleanUp({ time: new Date() })),
    [dispatch],
  )

  React.useEffect(() => {
    const timer = setInterval(cleanup, RELEASE_TIME)
    return () => clearInterval(timer)
  }, [cleanup])

  return <Ctx.Provider value={inst}>{children}</Ctx.Provider>
}

export function useResourceCache() {
  return React.useContext(Ctx)
}

export const use = useResourceCache

/**
 * @deprecated Use @tanstack/react-query
 */
export function useData(resource, input, opts = {}) {
  const { access, claim, release, subscribe } = use()
  const inputMemo = useMemoEq(input, R.identity)
  const [entry, setEntry] = React.useState(() => access(resource, input))
  React.useEffect(() => {
    let prevEntry = access(resource, inputMemo)
    claim(resource, inputMemo)
    const unsubscribe = subscribe(() => {
      const newEntry = access(resource, inputMemo)
      if (!R.equals(newEntry, prevEntry)) {
        setEntry(newEntry)
        prevEntry = newEntry
      }
    })
    return () => {
      unsubscribe()
      release(resource, inputMemo)
    }
  }, [resource, inputMemo, access, claim, release, subscribe])

  return opts.suspend ? suspend(entry) : entry
}
