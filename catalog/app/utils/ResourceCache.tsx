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

export interface Resource<I, O> {
  name: string
  id: string
  fetch: (input: I) => Promise<O>
  key: (input: I) => unknown
  persist: boolean
}

// AsyncResult value for an Entry: Init | Pending | Err(any) | Ok(O)
export interface Entry<O> {
  promise: Promise<O>
  result: ReturnType<typeof AsyncResult.Init>
  claimed: number
  releasedAt?: Date
}

// State = Map<resource.id, Map<key, Entry<O>>>
type State = I.Map<unknown, unknown>

// The redux instance exposed via context. Typed loosely because the underlying
// resource/entry generics are erased once stored in the Immutable state map.
export interface CacheInstance {
  access: (resource: any, input: any) => any
  get: (resource: any, input: any) => any
  patch: (
    resource: any,
    input: any,
    update: (entry: any) => any,
    silent?: boolean,
  ) => void
  patchOk: (
    resource: any,
    input: any,
    updateOk: (value: any) => any,
    silent?: boolean,
  ) => void
  claim: (resource: any, input: any) => void
  release: (resource: any, input: any) => void
  subscribe: (listener: () => void) => () => void
}

const Ctx = React.createContext<CacheInstance | null>(null)

const RELEASE_TIME = 5000

interface CreateResourceOptions<I, O> {
  name: string
  fetch: (input: I) => Promise<O>
  key?: (input: I) => unknown
  persist?: boolean
}

export const createResource = <I, O>({
  name,
  fetch,
  key = R.identity,
  persist = false,
}: CreateResourceOptions<I, O>): Resource<I, O> => ({
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

const keyFor = (resource: Resource<any, any>, input: any) => [
  resource.id,
  I.fromJS(resource.key(input)),
]

const reducer = reduxTools.withInitialState<State>(
  I.Map(),
  Action.reducer({
    Init:
      ({ resource, input, promise }: any) =>
      (s: State) =>
        s.updateIn(keyFor(resource, input), (entry: any) => {
          if (entry) throw new Error('Init: entry already exists')
          return {
            promise,
            result: AsyncResult.Init(),
            claimed: resource.persist ? 1 : 0, // "persistent" resources won't be released
          }
        }),
    Request:
      ({ resource, input }: any) =>
      (s: State) =>
        s.updateIn(keyFor(resource, input), (entry: any) => {
          if (!entry) throw new Error('Request: entry does not exist')
          if (!AsyncResult.Init.is(entry.result)) {
            throw new Error('Request: invalid transition')
          }
          return { ...entry, result: AsyncResult.Pending() }
        }),
    Response:
      ({ resource, input, result }: any) =>
      (s: State) =>
        s.updateIn(keyFor(resource, input), (entry: any) => {
          if (!entry) return undefined // released before response
          if (!AsyncResult.Pending.is(entry.result)) {
            throw new Error('Response: invalid transition')
          }
          return { ...entry, result }
        }),
    Patch:
      ({ resource, input, update, silent = false }: any) =>
      (s: State) =>
        s.updateIn(keyFor(resource, input), (entry: any) => {
          if (!entry) {
            if (silent) return entry
            throw new Error('Patch: entry does not exist')
          }
          return update(entry)
        }),
    Claim:
      ({ resource, input }: any) =>
      (s: State) =>
        s.updateIn(keyFor(resource, input), (entry: any) => {
          if (!entry) throw new Error('Claim: entry does not exist')
          return { ...entry, claimed: entry.claimed + 1 }
        }),
    Release:
      ({ resource, input, releasedAt }: any) =>
      (s: State) =>
        s.updateIn(keyFor(resource, input), (entry: any) => {
          if (!entry) throw new Error('Release: entry does not exist')
          return { ...entry, claimed: entry.claimed - 1, releasedAt }
        }),
    CleanUp:
      ({ time }: any) =>
      (s: State) =>
        (s as any).map((r: any) =>
          r.filter(
            (entry: any) =>
              entry.claimed >= 1 ||
              !entry.releasedAt ||
              time - entry.releasedAt < RELEASE_TIME,
          ),
        ),
    __: () => R.identity,
  }) as reduxTools.Reducer<State>,
)

export const suspend = ({ promise, result }: Pick<Entry<any>, 'promise' | 'result'>) =>
  AsyncResult.case(
    {
      Init: () => {
        throw promise
      },
      Pending: () => {
        throw promise
      },
      Err: (e: any) => {
        throw e
      },
      Ok: R.identity,
    },
    result,
  )

export const Provider = function ResourceCacheProvider({
  children,
}: React.PropsWithChildren<{}>) {
  const { dispatch, subscribe, getState } = useConstant(() =>
    redux.createStore(reducer as redux.Reducer),
  )

  const getEntry = React.useCallback(
    (resource: any, input: any) => getState().getIn(keyFor(resource, input)),
    [getState],
  )

  const init = React.useCallback(
    (resource: any, input: any) => {
      const { resolver, promise } = defer()
      dispatch(Action.Init({ resource, input, resolver, promise }))
      setTimeout(() => {
        dispatch(Action.Request({ resource, input }))
        resource.fetch(input).then(
          (res: any) => {
            dispatch(Action.Response({ resource, input, result: AsyncResult.Ok(res) }))
            resolver.resolve(res)
          },
          (e: any) => {
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
    (resource: any, input: any) => getEntry(resource, input) ?? init(resource, input),
    [getEntry, init],
  )

  const get = React.useMemo(() => R.pipe(access, suspend), [access])

  const patch = React.useCallback(
    (resource: any, input: any, update: (entry: any) => any, silent?: boolean) => {
      dispatch(Action.Patch({ resource, input, update, silent }))
    },
    [dispatch],
  )

  const patchOk = React.useCallback(
    (resource: any, input: any, updateOk: (value: any) => any, silent?: boolean) => {
      const update = R.when(
        (s: any) => AsyncResult.Ok.is(s.result),
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
    (resource: any, input: any) => {
      dispatch(Action.Claim({ resource, input }))
    },
    [dispatch],
  )

  const release = React.useCallback(
    (resource: any, input: any) => {
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
  return React.useContext(Ctx) as CacheInstance
}

export const use = useResourceCache

/**
 * @deprecated Use @tanstack/react-query
 */
export function useData(
  resource: any,
  input: any,
  opts: { suspend?: boolean } = {},
): any {
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
