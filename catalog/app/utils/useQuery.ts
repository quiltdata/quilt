import * as R from 'ramda'
import * as urql from 'urql'

import useMemoEq from 'utils/useMemoEq'

interface OpCases<Data, OnData, OnError, OnFecthing> {
  data: (data: Data, error: urql.CombinedError | undefined) => OnData
  error: (error: urql.CombinedError | undefined) => OnError
  fetching: () => OnFecthing
}

const opCase =
  <Data>(result: urql.UseQueryState<Data, any>) =>
  <OnData, OnError, OnFecthing>({
    data,
    error,
    fetching,
  }: OpCases<Data, OnData, OnError, OnFecthing>) => {
    if (result.fetching) return fetching()
    if (result.data) return data(result.data, result.error)
    return error(result.error)
  }

interface UseQueryArgs<Variables, Data> extends urql.UseQueryArgs<Variables, Data> {
  suspend?: boolean
}

export interface UseQueryResult<Data, Variables = any>
  extends urql.UseQueryState<Data, Variables> {
  case: <OnData, OnError, OnFecthing>(
    cases: OpCases<Data, OnData, OnError, OnFecthing>,
  ) => OnData | OnError | OnFecthing
  run: (opts?: Partial<urql.OperationContext>) => void
}

export function useQuery<Variables, Data>({
  context,
  suspend = false,
  // XXX: add staleAsFetching option?
  ...args
}: UseQueryArgs<Variables, Data>): UseQueryResult<Data, Variables> {
  const ctxMemo = useMemoEq({ suspense: suspend, ...context }, R.identity)
  const [result, run] = urql.useQuery({ ...args, context: ctxMemo })
  return useMemoEq({ ...result, run, case: useMemoEq(result, opCase) }, R.identity)
}

export default useQuery
