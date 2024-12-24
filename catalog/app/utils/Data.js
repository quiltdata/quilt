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
    (prev) =>
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

// Use it to test AsyncResult states
// example: `createResult(AsyncResult.Err(new Error('Expected')))`
export function createResult(result) {
  return {
    case: (cases, ...args) => AsyncResult.case(cases, result, ...args),
    result,
  }
}

export function useData(request, params, { noAutoFetch = false } = {}) {
  // TODO: accept custom key extraction fn (params => key for comparison)
  const [state, setState] = React.useState(initial)
  const stateRef = React.useRef()
  stateRef.current = state

  const mountRef = React.useRef(true)
  React.useEffect(() => () => (mountRef.current = false), [])
  const dispatch = (action) => {
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
      (cases, ...args) =>
        AsyncResult.case(cases, result, ...args),
  )

  return useMemoEq({ result, fetch, case: doCase }, R.identity)
}

export const use = useData

export function Fetcher({ fetch, params, noAutoFetch, children }) {
  const { result, ...rest } = useData(fetch, params, { noAutoFetch })
  return children(result, rest)
}

export default Fetcher
