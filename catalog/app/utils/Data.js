import * as R from 'ramda'
import * as React from 'react'

import AsyncResult from 'utils/AsyncResult'
import * as RT from 'utils/reactTools'
import tagged from 'utils/tagged'
import useMemoEq from 'utils/useMemoEq'
import usePrevious from 'utils/usePrevious'

const Action = tagged(['Reset', 'Request', 'Response'])

const initial = AsyncResult.Init()

const mapResult = AsyncResult.mapCase({ Pending: R.prop('prev') })

const reducer = Action.reducer({
  Reset: () => () => initial,
  Request: ({ request, params }) => (prev) =>
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

export function useData(request, params, { noAutoFetch = false } = {}) {
  // TODO: accept custom key extraction fn (params => key for comparison)
  const [state, dispatch] = React.useReducer(reducer, initial)

  const fetch = React.useCallback(() => {
    dispatch(Action.Request({ request, params }))
    return request(params)
      .then(AsyncResult.Ok)
      .catch(AsyncResult.Err)
      .then((result) => {
        dispatch(Action.Response({ request, params, result }))
        return result
      })
  }, [request, params])
  // FIXME: probably memoization doesnt work here bc params is an object and it
  // gets constructed anew every time on the caller side

  usePrevious({ params, noAutoFetch }, (prev) => {
    if (R.equals({ params, noAutoFetch }, prev)) return
    if (noAutoFetch) dispatch(Action.Reset())
    else fetch()
  })

  const result = useMemoEq(state, mapResult)

  const doCase = React.useMemo(
    () => (cases, ...args) => AsyncResult.case(cases, result, ...args),
    [result],
  )

  return { result, fetch, case: doCase }
}

export const use = useData

export function Fetcher({ fetch, params, noAutoFetch, children }) {
  const { result, ...rest } = useData(fetch, params, { noAutoFetch })
  return children(result, rest)
}

export default Fetcher

export const withData = ({
  params: getParams = R.identity,
  fetch,
  name = 'data',
  autoFetch = true,
}) =>
  RT.composeHOC('Data.withData', (Component) => (props) => (
    <Fetcher fetch={fetch} params={getParams(props)} noAutoFetch={!autoFetch}>
      {(result, opts) => <Component {...{ ...props, [name]: { result, ...opts } }} />}
    </Fetcher>
  ))
