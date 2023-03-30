import * as R from 'ramda'
import * as React from 'react'
import * as urql from 'urql'
import * as Sentry from '@sentry/react'

import log from 'utils/Logging'
import { BaseError } from 'utils/error'
import useMemoEq from 'utils/useMemoEq'

export class OperationError extends BaseError {}

export class QueryError<Data = any> extends OperationError {
  constructor(result?: urql.UseQueryState<Data, any>) {
    super('GraphQL query error')
    this.result = result
  }
}

export class MutationError<Data, Variables> extends OperationError {
  constructor(result?: urql.OperationResult<Data, Variables>) {
    super('GraphQL mutation error')
    this.result = result
  }
}

const defaultErrorHandler = <Data>(error: urql.CombinedError | QueryError<Data>) => {
  throw error
}

interface OpCases<Data, OnData, OnFecthing, OnError = never> {
  data: (
    data: Data,
    error: urql.CombinedError | undefined,
    result: urql.UseQueryState<Data, any>,
  ) => OnData
  fetching: (result: urql.UseQueryState<Data, any>) => OnFecthing
  error?: (
    error: urql.CombinedError | QueryError<Data>,
    result: urql.UseQueryState<Data, any>,
  ) => OnError
}

interface DoCase<Data> {
  <OnData, OnFetching>(cases: OpCases<Data, OnData, OnFetching>): OnData | OnFetching
  <OnData, OnFetching, OnError>(cases: OpCases<Data, OnData, OnFetching, OnError>):
    | OnData
    | OnFetching
    | OnError
}

interface CaseOptions {
  partial: boolean
}

const mkCase =
  <Data>(result: urql.UseQueryState<Data, any>, opts: CaseOptions): DoCase<Data> =>
  <OnData, OnFetching, OnError = never>({
    data,
    error = defaultErrorHandler,
    fetching,
  }: OpCases<Data, OnData, OnFetching, OnError>) => {
    const isPartial = result.operation?.context?.meta?.cacheOutcome === 'partial'
    if (!opts.partial && isPartial) return fetching(result)
    if (result.data) return data(result.data, result.error, result)
    if (result.fetching) return fetching(result)
    return error(result.error || new QueryError(result), result)
  }

interface UseQueryArgs<Variables, Data> extends urql.UseQueryArgs<Variables, Data> {
  suspend?: boolean
  partial?: boolean
}

export interface UseQueryResult<Data, Variables = any>
  extends urql.UseQueryState<Data, Variables> {
  case: DoCase<Data>
  run: (opts?: Partial<urql.OperationContext>) => void
}

export function useQuery<Variables, Data>({
  context,
  suspend = false,
  partial = false,
  // XXX: add staleAsFetching option?
  ...args
}: UseQueryArgs<Variables, Data>): UseQueryResult<Data, Variables> {
  const ctxMemo = useMemoEq({ suspense: suspend, ...context }, R.identity)
  const [result, run] = urql.useQuery({ ...args, context: ctxMemo })
  return useMemoEq([result, run, partial], () => ({
    ...result,
    run,
    case: mkCase(result, { partial }),
  }))
}

type QueryInput<Data, Variables> = Parameters<typeof urql.useMutation<Data, Variables>>[0]

export function useMutation<Data, Variables>(query: QueryInput<Data, Variables>) {
  const [, execMutation] = urql.useMutation<Data, Variables>(query)

  return React.useCallback(
    async (variables?: Variables, context?: Partial<urql.OperationContext>) => {
      const result = await execMutation(variables, context)

      if (!result.data) {
        if (result.error) throw result.error
        throw new MutationError(result)
      }

      if (result.error) {
        log.warn('Error while executing the mutation:', result.error)
        Sentry.captureException(result.error, { extra: { result } })
      }

      return result.data
    },
    [execMutation],
  )
}
