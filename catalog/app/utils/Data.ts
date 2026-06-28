import * as R from 'ramda'
import * as React from 'react'

import AsyncResult from 'utils/AsyncResult'
import tagged from 'utils/tagged'
import useMemoEq from 'utils/useMemoEq'
import usePrevious from 'utils/usePrevious'

const Action = tagged(['Reset', 'Request', 'Response'])

const initial = AsyncResult.Init()

const mapResult = AsyncResult.mapCase({ Pending: R.prop('prev') })

const reducer = Action.reducer({
  Reset: () => () => initial,
  Request:
    ({ request, params }) =>
    (prev: unknown) =>
      AsyncResult.Pending({ request, params, prev: mapResult(prev) }),
  Response: ({ request, params, result }) =>
    AsyncResult.case({
      Pending: (p) =>
        R.equals([p.request, p.params], [request, params])
          ? result
          : AsyncResult.Pending(p),
      _: R.identity,
    }),
})

// `result` is an AsyncResult tagged instance and `cases` are passed through to
// the legacy (dynamically typed) tagged union, so both stay loose — matching
// the actual runtime contract consumers rely on (they feed `result` into
// `AsyncResult.case` and call `.case(cases, ...)` for any variant set).
// Accepts any variant-cases object — kept fully loose so a DataHook stays
// assignable to consumers' own typed AsyncData<T> case signatures.
type Cases = any

interface DataResult {
  case: (cases: Cases, ...args: any[]) => any
  result: unknown
}

// Use it to test AsyncResult states
// example: `createResult(AsyncResult.Err(new Error('Expected')))`
export function createResult(result: unknown): DataResult {
  return {
    case: (cases: Cases, ...args: any[]) => AsyncResult.case(cases, result, ...args),
    result,
  }
}

interface UseDataOptions {
  noAutoFetch?: boolean
}

interface DataHook extends DataResult {
  fetch: () => Promise<unknown>
}

export function useData(
  // params are intentionally loose: the hook is used across many call sites with
  // heterogeneous request/param shapes (matching the legacy untyped contract).
  request: (params: any) => Promise<unknown>,
  params: any,
  { noAutoFetch = false }: UseDataOptions = {},
): DataHook {
  // TODO: accept custom key extraction fn (params => key for comparison)
  const [state, setState] = React.useState(initial)
  const stateRef = React.useRef<unknown>()
  stateRef.current = state

  const mountRef = React.useRef(true)
  React.useEffect(
    () => () => {
      mountRef.current = false
    },
    [],
  )
  const dispatch = (action: unknown) => {
    if (!mountRef.current) return
    setState((stateRef.current = reducer(stateRef.current, action)))
  }

  const fetch = useMemoEq([request, params], () => () => {
    dispatch(Action.Request({ request, params }))
    return request(params)
      .then(AsyncResult.Ok)
      .catch(AsyncResult.Err)
      .then((result) => {
        dispatch(Action.Response({ request, params, result }))
        return result
      })
  })

  const prev = usePrevious({ params, noAutoFetch })
  if (!R.equals({ params, noAutoFetch }, prev)) {
    if (noAutoFetch) dispatch(Action.Reset())
    else fetch()
  }

  const result = useMemoEq(stateRef.current, mapResult)

  const doCase = useMemoEq(
    [result],
    () =>
      (cases: Cases, ...args: any[]) =>
        AsyncResult.case(cases, result, ...args),
  )

  return useMemoEq({ result, fetch, case: doCase }, R.identity)
}

export const use = useData

interface FetcherProps {
  fetch: (params: any) => Promise<unknown>
  params: any
  noAutoFetch?: boolean
  children: (result: unknown, rest: Omit<DataHook, 'result'>) => React.ReactNode
}

export function Fetcher({ fetch, params, noAutoFetch, children }: FetcherProps) {
  const { result, ...rest } = useData(fetch, params, { noAutoFetch })
  return children(result, rest)
}

export default Fetcher
