import * as R from 'ramda'
import * as urql from 'urql'

import useMemoEq from 'utils/useMemoEq'

interface OpCases<D, DR, ER, FR> {
  data: (data: D, error: urql.CombinedError | undefined) => DR
  error: (error: urql.CombinedError | undefined) => ER
  fetching: () => FR
}

const opCase =
  <D>(result: urql.UseQueryState<D, any>) =>
  <DR, ER, FR>({ data, error, fetching }: OpCases<D, DR, ER, FR>) => {
    if (result.fetching) return fetching()
    if (result.data) return data(result.data, result.error)
    return error(result.error)
  }

interface UseQueryArgs<V, D> extends urql.UseQueryArgs<V, D> {
  suspend?: boolean
}

export default function useQuery<V, D>({
  context,
  suspend = false,
  ...args
}: UseQueryArgs<V, D>) {
  const ctxMemo = useMemoEq({ suspense: suspend, ...context }, R.identity)
  const [result, run] = urql.useQuery({ ...args, context: ctxMemo })
  return useMemoEq({ ...result, run, case: useMemoEq(result, opCase) }, R.identity)
}
