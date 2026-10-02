import * as R from 'ramda'
import * as React from 'react'

import * as AsyncResult from 'utils/AsyncResult'
import useMemoEq from 'utils/useMemoEq'
import usePrevious from 'utils/usePrevious'

// The async data machine for imperative fetches. A small reducer drives an
// `AsyncResult` state through Init → Pending → Ok | Err, carrying the previous
// result across refetches so a stale `Ok` survives while the next request is in
// flight. Migrated to the effect-backed `utils/AsyncResult` (strict named API).

type Request = (params: any) => Promise<any>

// The `Pending` payload used *within this module*: it boxes the fetch identity
// (request + params) alongside the previous result, so `Response` can tell
// whether the settled result still corresponds to the latest request.
interface PendingRecord {
  request: Request
  params: any
  prev: AsyncResult.AsyncResult<unknown, unknown>
}

const isPendingRecord = (p: unknown): p is PendingRecord =>
  !!p && typeof p === 'object' && 'prev' in p

// Local, typed action union (replaces the old untyped `utils/tagged` factory).
type Action =
  | { readonly _tag: 'Reset' }
  | { readonly _tag: 'Request'; readonly request: Request; readonly params: any }
  | {
      readonly _tag: 'Response'
      readonly request: Request
      readonly params: any
      readonly result: AsyncResult.AsyncResult<unknown, unknown>
    }

const Reset = (): Action => ({ _tag: 'Reset' })
const Request = (request: Request, params: any): Action => ({
  _tag: 'Request',
  request,
  params,
})
const Response = (
  request: Request,
  params: any,
  result: AsyncResult.AsyncResult<unknown, unknown>,
): Action => ({ _tag: 'Response', request, params, result })

type State = AsyncResult.AsyncResult<unknown, unknown>

const initial: State = AsyncResult.init()

// Unwrap a `Pending` back to the previous result it boxes (peeling the
// `{ request, params, prev }` record), leaving other variants untouched. Used
// to expose the *displayed* result (stale Ok during refetch) to consumers.
const mapResult = AsyncResult.mapCase<unknown, unknown, unknown, unknown>({
  Pending: (p) => (isPendingRecord(p) ? p.prev : p),
})

const reducer = (prev: State, action: Action): State => {
  switch (action._tag) {
    case 'Reset':
      return initial
    case 'Request':
      return AsyncResult.pending<unknown, unknown>({
        request: action.request,
        params: action.params,
        prev: mapResult(prev),
      } satisfies PendingRecord)
    case 'Response':
      return AsyncResult.match(
        {
          Pending: (p): State =>
            isPendingRecord(p) &&
            R.equals([p.request, p.params], [action.request, action.params])
              ? action.result
              : AsyncResult.pending(p),
          _: (r): State => r,
        },
        prev,
      )
    default:
      return prev
  }
}

// Use it to test AsyncResult states
// example: `createResult(AsyncResult.err(new Error('Expected')))`
export function createResult(result: AsyncResult.AsyncResult<unknown, unknown>) {
  return {
    case: (cases: any, ...args: any[]) => AsyncResult.caseCompat(cases, result, ...args),
    result,
  }
}

interface UseDataOpts {
  noAutoFetch?: boolean
}

export function useData(
  request: Request,
  params: any,
  { noAutoFetch = false }: UseDataOpts = {},
) {
  // TODO: accept custom key extraction fn (params => key for comparison)
  const [state, setState] = React.useState<State>(initial)
  const stateRef = React.useRef<State>(state)
  stateRef.current = state

  const mountRef = React.useRef(true)
  React.useEffect(() => () => void (mountRef.current = false), [])
  const dispatch = (action: Action) => {
    if (!mountRef.current) return
    setState((stateRef.current = reducer(stateRef.current, action)))
  }

  const fetch = useMemoEq([request, params] as const, () => () => {
    dispatch(Request(request, params))
    return request(params)
      .then(AsyncResult.ok)
      .catch(AsyncResult.err)
      .then((result: AsyncResult.AsyncResult<unknown, unknown>) => {
        dispatch(Response(request, params, result))
        return result
      })
  })

  const prev = usePrevious({ params, noAutoFetch })
  if (!R.equals({ params, noAutoFetch }, prev)) {
    if (noAutoFetch) dispatch(Reset())
    else fetch()
  }

  const result = useMemoEq(stateRef.current, mapResult)

  const doCase = useMemoEq(
    [result] as const,
    () =>
      (cases: any, ...args: any[]) =>
        AsyncResult.caseCompat(cases, result, ...args),
  )

  return useMemoEq({ result, fetch, case: doCase }, R.identity)
}

export const use = useData

interface FetcherProps {
  fetch: Request
  params: any
  noAutoFetch?: boolean
  children: (
    result: AsyncResult.AsyncResult<unknown, unknown>,
    rest: { fetch: () => Promise<unknown>; case: (cases: any, ...args: any[]) => any },
  ) => React.ReactNode
}

export function Fetcher({ fetch, params, noAutoFetch, children }: FetcherProps) {
  const { result, ...rest } = useData(fetch, params, { noAutoFetch })
  return children(result, rest)
}

export default Fetcher
