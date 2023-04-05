import * as R from 'ramda'
import * as React from 'react'
import * as urql from 'urql'
import * as Sentry from '@sentry/react'

import log from 'utils/Logging'
import { BaseError } from 'utils/error'
import useMemoEq from 'utils/useMemoEq'

export class OperationError extends BaseError {}

export class QueryError<Data = any> extends OperationError {
  constructor(result?: ResultForData<Data>) {
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

type ResultForData<Data> = urql.UseQueryState<Data, any>

type ErrorForData<Data> = urql.CombinedError | QueryError<Data>

type FoldOnData<Data, OnData> = (data: Data, result: ResultForData<Data>) => OnData

type FoldOnFetching<Data, OnFetching> = (result: ResultForData<Data>) => OnFetching

type FoldOnError<Data, OnError> = (
  error: ErrorForData<Data>,
  result: ResultForData<Data>,
) => OnError

interface FoldCases<Data, OnData, OnFecthing, OnError = never> {
  data: FoldOnData<Data, OnData>
  fetching: FoldOnFetching<Data, OnFecthing>
  error?: FoldOnError<Data, OnError>
}

interface FoldOptions {
  partial?: boolean
  silent?: boolean
}

interface FoldConfig<Data, OnData, OnFecthing, OnError>
  extends FoldCases<Data, OnData, OnFecthing, OnError>,
    FoldOptions {}

/**
 * Fold / unwrap an {@link urql#UseQueryState | `urql` query result} into a value.
 *
 * @param result - The query result as returned by {@link urql#useQuery} (or our {@link useQuery} wrapper around it).
 *
 * @param config - Fold cases (for data, error, fetching states) and options (silent, partial).
 * @param config.data - This is called when the query data is available.
 * @param config.fetching - This is called when the query is fetching.
 * @param config.error - This is called when the query has an error. Optional, defaults to throwing the error.
 * @param config.partial - Whether to treat partial data (from cache) as complete or to wait for the full data. Optional, defaults to `false`.
 * @param config.silent - Whether to disable logging errors and sending them to Sentry. Optional, defaults to `false` (error logging and capturing enabled).
 *
 * @returns The folded value.
 *
 * @example
 * ```ts
 * const result = useQuery(...)
 * const value = fold(result, {
 *   data: (data) => data,
 *   fetching: () => 'fetching',
 * })
 * ```
 */
export function fold<Data, OnData, OnFetching, OnError = never>(
  result: ResultForData<Data>,
  config: FoldConfig<Data, OnData, OnFetching, OnError>,
): OnData | OnFetching | OnError {
  const isPartial = result.operation?.context?.meta?.cacheOutcome === 'partial'
  if (!config.partial && isPartial) return config.fetching(result)

  if (result.data) {
    if (!config.silent && result.error) {
      log.warn('Non-critical error while executing the query:', result.error)
      Sentry.captureException(result.error, { extra: { result } })
    }
    return config.data(result.data, result)
  }

  if (result.fetching) return config.fetching(result)

  const err = result.error || new QueryError(result)
  if (config.error) return config.error(err, result)
  if (!config.silent) {
    log.error('Critical error while executing the query:', err)
    Sentry.captureException(err, { extra: { result } })
  }
  throw err
}

/**
 * {@link fold} curried (config first, result last).
 *
 * @example
 * ```ts
 * const result = useQuery(MY_QUERY_DOC)
 * const foldResult = foldC({
 *   // help TS infer the type of the data
 *   data: (data: DataForDoc<typeof MY_QUERY_DOC>) => data,
 *   fetching: () => 'fetching',
 * })
 * const value = foldResult(result)
 * ```
 */
export const foldC =
  <Data, OnData, OnFetching, OnError = never>(
    opts: FoldConfig<Data, OnData, OnFetching, OnError>,
  ) =>
  (result: ResultForData<Data>): OnData | OnFetching | OnError =>
    fold(result, opts)

export type DataForDoc<Doc extends urql.TypedDocumentNode<any, any>> =
  Doc extends urql.TypedDocumentNode<infer Data, any> ? Data : never

export type VariablesForDoc<Doc extends urql.TypedDocumentNode<any, any>> =
  Doc extends urql.TypedDocumentNode<any, infer Variables> ? Variables : never

export type QueryResultForDoc<Doc extends urql.TypedDocumentNode<any, any>> =
  UseQueryResult<DataForDoc<Doc>, VariablesForDoc<Doc>>

type QueryDoc<Data, Variables> = urql.UseQueryArgs<Variables, Data>['query']

type UseQueryOptions<Data, Variables> = Omit<
  urql.UseQueryArgs<Variables, Data>,
  'suspense' | 'query' | 'variables'
>

interface UseQueryResult<Data, Variables> extends urql.UseQueryState<Data, Variables> {
  run: urql.UseQueryResponse<Data, Variables>[1]
}

/**
 * An opinionated wrapper around {@link urql#useQuery} that:
 * - disables suspense
 * - memoizes the context to ensure it doesn't change on every render
 * - puts the `run` function in the returned result object and memoizes it
 *
 * @param query - The query document.
 * @param variables - The variables. Optional.
 * @param options - The options ({@link urql#UseQueryArgs} minus `query`, `variables` and `suspense`). Optional.
 * @param options.context - The context. Optional.
 *
 * @returns The query result as returned by {@link urql#useQuery} + the `run` function.
 *
 * @example
 * ```ts
 * const query = useQuery(MY_QUERY, variables)
 * ```
 */
export function useQuery<Data, Variables = {}>(
  query: QueryDoc<Data, Variables>,
  variables?: Variables,
  options?: UseQueryOptions<Data, Variables>,
): UseQueryResult<Data, Variables> {
  const { context: ctx, ...rest } = options || {}
  const context = useMemoEq({ suspense: false, ...ctx }, R.identity)
  const [result, run] = urql.useQuery({ query, variables, context, ...rest })
  return useMemoEq({ ...result, run }, R.identity)
}

/**
 * An opinionated wrapper around {@link urql#useQuery} that:
 * - enables suspense
 * - memoizes the context to ensure it doesn't change on every render
 * - suspends and unwraps the data
 *
 * @param query - The query document.
 * @param variables - The variables. Optional.
 * @param options - The options ({@link urql#UseQueryArgs} minus `query`, `variables` and `suspense`). Optional.
 * @param options.context - The context. Optional.
 *
 * @returns The data returned by the query.
 *
 * @throws An error if the query failed ({@link urql#CombinedError} if returned by the upstream, otherwise {@link QueryError}).
 *
 * @example
 * ```ts
 * const data = useQueryS(MY_QUERY, variables)
 * ```
 */
export function useQueryS<Data, Variables>(
  query: QueryDoc<Data, Variables>,
  variables?: Variables,
  options?: UseQueryOptions<Data, Variables>,
): Data {
  const { context, ...restOpts } = options || {}
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

interface RunMutationContext extends Partial<urql.OperationContext> {
  silent?: boolean
}

type RunMutation<Data, Variables> = (
  variables?: Variables,
  context?: RunMutationContext,
) => Promise<Data>

/**
 * An opinionated wrapper around {@link urql#useMutation} that unwraps the data
 * when invoked and logs / captures errors.
 *
 * @param query - The query document.
 *
 * @returns A function that runs the mutation.
 *
 * @example
 * ```ts
 * const mutate = useMutation(MY_MUTATION)
 * const data = await mutate(variables)
 * ```
 */
export function useMutation<Data, Variables>(
  query: QueryDoc<Data, Variables>,
): RunMutation<Data, Variables> {
  const [, execMutation] = urql.useMutation<Data, Variables>(query)

  return React.useCallback(
    async (variables?: Variables, context?: RunMutationContext) => {
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
