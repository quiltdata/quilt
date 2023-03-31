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

interface FoldOptions<Data, OnData, OnFecthing, OnError = never> {
  data: (data: Data, result: urql.UseQueryState<Data, any>) => OnData
  fetching: (result: urql.UseQueryState<Data, any>) => OnFecthing
  error?: (
    error: urql.CombinedError | QueryError<Data>,
    result: urql.UseQueryState<Data, any>,
  ) => OnError
  partial?: boolean
  silent?: boolean
}

export const foldC =
  <Data, OnData, OnFetching, OnError = never>({
    data,
    error,
    fetching,
    partial = false,
    silent = false,
  }: FoldOptions<Data, OnData, OnFetching, OnError>) =>
  (result: urql.UseQueryState<Data, any>) => {
    const isPartial = result.operation?.context?.meta?.cacheOutcome === 'partial'
    if (!partial && isPartial) return fetching(result)

    if (result.data) {
      if (!silent && result.error) {
        log.warn('Non-critical error while executing the query:', result.error)
        Sentry.captureException(result.error, { extra: { result } })
      }
      return data(result.data, result)
    }

    if (result.fetching) return fetching(result)

    const err = result.error || new QueryError(result)
    if (error) return error(err, result)
    if (!silent) {
      log.error('Critical error while executing the query:', err)
      Sentry.captureException(err, { extra: { result } })
    }
    throw error
  }

export const fold = <Data, OnData, OnFetching, OnError = never>(
  result: urql.UseQueryState<Data, any>,
  casesAndOpts: FoldOptions<Data, OnData, OnFetching, OnError>,
) => foldC(casesAndOpts)(result)

export function useQuery<Data, Variables = {}>(
  query: urql.UseQueryArgs<Variables, Data>['query'],
  variables?: urql.UseQueryArgs<Variables, Data>['variables'],
  opts?: Omit<urql.UseQueryArgs<Variables, Data>, 'suspense' | 'query' | 'variables'>,
) {
  const { context: ctx, ...rest } = opts || {}
  const context = useMemoEq({ suspense: false, ...ctx }, R.identity)
  const [result, run] = urql.useQuery({ query, variables, context, ...rest })
  return useMemoEq({ ...result, run }, R.identity)
}

export type QueryResultForDoc<Doc extends urql.TypedDocumentNode<any, any>> =
  Doc extends urql.TypedDocumentNode<infer Data, infer Variables>
    ? ReturnType<typeof useQuery<Data, Variables>>
    : never

export function useQueryS<Data, Variables>(
  query: urql.UseQueryArgs<Variables, Data>['query'],
  variables?: urql.UseQueryArgs<Variables, Data>['variables'],
  opts?: Omit<urql.UseQueryArgs<Variables, Data>, 'suspense' | 'query' | 'variables'>,
): Data {
  const { context, ...restOpts } = opts || {}
  const ctxMemo = useMemoEq({ ...context, suspense: true }, R.identity)
  const [result] = urql.useQuery({ query, variables, context: ctxMemo, ...restOpts })

  if (result.data) {
    if (result.error) {
      log.warn('Non-critical error while executing the query:', result.error)
      Sentry.captureException(result.error, { extra: { result } })
    }
    return result.data
  }

  // this should probably never happen, because urql is supposed to throw an error
  // itself when getting no data in suspense mode
  const err = result.error || new QueryError(result)
  log.error('Critical error while executing the query:', err)
  Sentry.captureException(err, { extra: { result } })
  throw err
}

type QueryInput<Data, Variables> = Parameters<typeof urql.useMutation<Data, Variables>>[0]

export function useMutation<Data, Variables>(query: QueryInput<Data, Variables>) {
  const [, execMutation] = urql.useMutation<Data, Variables>(query)

  return React.useCallback(
    async (
      variables?: Variables,
      context?: Partial<urql.OperationContext> & { silent?: boolean },
    ) => {
      const { silent = false, ...ctx } = context || {}
      const result = await execMutation(variables, ctx)

      if (!result.data) {
        const err = result.error || new MutationError(result)
        if (!silent) {
          log.error('Critical error while executing the mutation:', err)
          Sentry.captureException(err, { extra: { result } })
        }
        throw err
      }

      if (!silent && result.error) {
        log.warn('Non-critical error while executing the mutation:', result.error)
        Sentry.captureException(result.error, { extra: { result } })
      }

      return result.data
    },
    [execMutation],
  )
}
