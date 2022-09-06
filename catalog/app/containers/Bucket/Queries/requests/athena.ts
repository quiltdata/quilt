import Athena from 'aws-sdk/clients/athena'
import * as React from 'react'

import * as AWS from 'utils/AWS'
import * as BucketPreferences from 'utils/BucketPreferences'
import { useData } from 'utils/Data'
import wait from 'utils/wait'

import * as storage from './storage'

import { AsyncData } from './requests'

// TODO: rename to requests.athena.Query
export interface AthenaQuery {
  body: string
  description?: string
  key: string
  name: string
}

export interface QueriesResponse {
  list: AthenaQuery[]
  next?: string
}

interface QueriesArgs {
  athena: Athena
  prev: QueriesResponse | null
  workgroup: string
}

function parseNamedQuery(query: Athena.NamedQuery): AthenaQuery {
  return {
    body: query.QueryString,
    description: query.Description,
    key: query.NamedQueryId!,
    name: query.Name,
  }
}

async function fetchQueries({
  athena,
  prev,
  workgroup,
}: QueriesArgs): Promise<QueriesResponse> {
  try {
    const queryIdsOutput = await athena
      ?.listNamedQueries({ WorkGroup: workgroup, NextToken: prev?.next })
      .promise()
    if (!queryIdsOutput.NamedQueryIds || !queryIdsOutput.NamedQueryIds.length)
      return {
        list: prev?.list || [],
        next: queryIdsOutput.NextToken,
      }

    const queriesOutput = await athena
      ?.batchGetNamedQuery({
        NamedQueryIds: queryIdsOutput.NamedQueryIds,
      })
      .promise()
    const parsed = (queriesOutput.NamedQueries || []).map(parseNamedQuery)
    const list = (prev?.list || []).concat(parsed)
    return {
      list,
      next: queryIdsOutput.NextToken,
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.log('Unable to fetch')
    // eslint-disable-next-line no-console
    console.error(e)
    throw e
  }
}

export function useQueries(
  workgroup: string,
  prev: QueriesResponse | null,
): AsyncData<QueriesResponse> {
  const athena = AWS.Athena.use()
  return useData(fetchQueries, { athena, prev, workgroup }, { noAutoFetch: !workgroup })
}

export type Workgroup = string

function getDefaultWorkgroup(
  list: Workgroup[],
  preferences?: BucketPreferences.AthenaPreferences,
): Workgroup {
  const workgroupFromConfig = preferences?.defaultWorkgroup
  if (workgroupFromConfig && list.includes(workgroupFromConfig)) {
    return workgroupFromConfig
  }
  return storage.getWorkgroup() || list[0]
}

interface WorkgroupArgs {
  athena: Athena
  workgroup: Workgroup
}

async function fetchWorkgroup({
  athena,
  workgroup,
}: WorkgroupArgs): Promise<Workgroup | null> {
  const workgroupOutput = await athena.getWorkGroup({ WorkGroup: workgroup }).promise()
  return workgroupOutput?.WorkGroup?.Configuration?.ResultConfiguration?.OutputLocation &&
    workgroupOutput?.WorkGroup?.State === 'ENABLED' &&
    workgroupOutput?.WorkGroup?.Name
    ? workgroupOutput.WorkGroup.Name
    : null
}

export interface WorkgroupsResponse {
  defaultWorkgroup: Workgroup
  list: Workgroup[]
  next?: string
}

interface WorkgroupsArgs {
  athena: Athena
  prev: WorkgroupsResponse | null
  preferences?: BucketPreferences.AthenaPreferences
}

async function fetchWorkgroups({
  athena,
  prev,
  preferences,
}: WorkgroupsArgs): Promise<WorkgroupsResponse> {
  try {
    const workgroupsOutput = await athena
      .listWorkGroups({ NextToken: prev?.next })
      .promise()
    const parsed = (workgroupsOutput.WorkGroups || []).map(
      ({ Name }) => Name || 'Unknown',
    )
    const available = (
      await Promise.all(parsed.map((workgroup) => fetchWorkgroup({ athena, workgroup })))
    ).filter(Boolean)
    const list = (prev?.list || []).concat(available as Workgroup[])
    return {
      defaultWorkgroup: getDefaultWorkgroup(list, preferences),
      list,
      next: workgroupsOutput.NextToken,
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.log('Unable to fetch')
    // eslint-disable-next-line no-console
    console.error(e)
    throw e
  }
}

export function useWorkgroups(
  prev: WorkgroupsResponse | null,
): AsyncData<WorkgroupsResponse> {
  const athena = AWS.Athena.use()
  const preferences = BucketPreferences.use()
  return useData(fetchWorkgroups, { athena, prev, preferences: preferences?.ui.athena })
}

export interface QueryExecution {
  catalog?: string
  completed?: Date
  created?: Date
  db?: string
  error?: Error
  id?: string
  outputBucket?: string
  query?: string
  status?: string // 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED'
  workgroup?: Athena.WorkGroupName
}

export interface QueryExecutionsResponse {
  list: QueryExecution[]
  next?: string
}

interface QueryExecutionsArgs {
  athena: Athena
  prev: QueryExecutionsResponse | null
  workgroup: string
}

function parseQueryExecution(queryExecution: Athena.QueryExecution): QueryExecution {
  return {
    catalog: queryExecution?.QueryExecutionContext?.Catalog,
    completed: queryExecution?.Status?.CompletionDateTime,
    created: queryExecution?.Status?.SubmissionDateTime,
    db: queryExecution?.QueryExecutionContext?.Database,
    id: queryExecution?.QueryExecutionId,
    outputBucket: queryExecution?.ResultConfiguration?.OutputLocation,
    query: queryExecution?.Query,
    status: queryExecution?.Status?.State,
    workgroup: queryExecution?.WorkGroup,
  }
}

function parseQueryExecutionError(
  error: Athena.UnprocessedQueryExecutionId,
): QueryExecution {
  return {
    error: new Error(error?.ErrorMessage || 'Unknown'),
    id: error?.QueryExecutionId,
  }
}

async function fetchQueryExecutions({
  athena,
  prev,
  workgroup,
}: QueryExecutionsArgs): Promise<QueryExecutionsResponse> {
  try {
    const executionIdsOutput = await athena
      .listQueryExecutions({ WorkGroup: workgroup, NextToken: prev?.next })
      .promise()

    const ids = executionIdsOutput.QueryExecutionIds
    if (!ids || !ids.length)
      return {
        list: [],
        next: executionIdsOutput.NextToken,
      }

    const executionsOutput = await athena
      ?.batchGetQueryExecution({ QueryExecutionIds: ids })
      .promise()
    const parsed = (executionsOutput.QueryExecutions || [])
      .map(parseQueryExecution)
      .concat(
        (executionsOutput.UnprocessedQueryExecutionIds || []).map(
          parseQueryExecutionError,
        ),
      )
    const list = (prev?.list || []).concat(parsed)
    return {
      list,
      next: executionIdsOutput.NextToken,
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.log('Unable to fetch')
    // eslint-disable-next-line no-console
    console.error(e)
    throw e
  }
}

export function useQueryExecutions(
  workgroup: string,
  prev: QueryExecutionsResponse | null,
): AsyncData<QueryExecutionsResponse> {
  const athena = AWS.Athena.use()
  return useData(
    fetchQueryExecutions,
    { athena, prev, workgroup },
    { noAutoFetch: !workgroup },
  )
}

async function waitForQueryStatus(
  athena: Athena,
  QueryExecutionId: string,
): Promise<QueryExecution> {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    // NOTE: await is used to intentionally pause loop and make requests in series
    // eslint-disable-next-line no-await-in-loop
    const statusData = await athena.getQueryExecution({ QueryExecutionId }).promise()
    const status = statusData?.QueryExecution?.Status?.State
    const parsed = statusData?.QueryExecution
      ? parseQueryExecution(statusData?.QueryExecution)
      : {
          id: QueryExecutionId,
        }
    if (status === 'FAILED' || status === 'CANCELLED') {
      const reason = statusData?.QueryExecution?.Status?.StateChangeReason || ''
      return {
        ...parsed,
        error: new Error(`${status}: ${reason}`),
      }
    }

    if (!status) {
      return {
        ...parsed,
        error: new Error('Unknown query execution status'),
      }
    }

    if (status === 'SUCCEEDED') {
      return parsed
    }

    // eslint-disable-next-line no-await-in-loop
    await wait(1000)
  }
}

export type QueryResultsValue = Athena.datumString

export interface QueryResultsColumnInfo {
  name: Athena.String
  type: Athena.String
}

export type QueryResultsColumns = QueryResultsColumnInfo[]
type Row = QueryResultsValue[]
export type QueryResultsRows = Row[]

export interface QueryResultsResponse {
  columns: QueryResultsColumns
  next?: string
  queryExecution: QueryExecution
  rows: QueryResultsRows
}

interface QueryResultsArgs {
  athena: Athena
  queryExecutionId: string
  prev: QueryResultsResponse | null
}

const emptyRow: Row = []
const emptyList: QueryResultsRows = []
const emptyColumns: QueryResultsColumns = []

async function fetchQueryResults({
  athena,
  queryExecutionId,
  prev,
}: QueryResultsArgs): Promise<QueryResultsResponse> {
  const queryExecution = await waitForQueryStatus(athena, queryExecutionId)
  if (queryExecution.error) {
    return {
      rows: emptyList,
      columns: emptyColumns,
      queryExecution,
    }
  }

  try {
    const queryResultsOutput = await athena
      .getQueryResults({
        QueryExecutionId: queryExecutionId,
        NextToken: prev?.next,
      })
      .promise()
    const parsed =
      queryResultsOutput.ResultSet?.Rows?.map(
        (row) => row?.Data?.map((item) => item?.VarCharValue || '') || emptyRow,
      ) || emptyList
    const rows = [...(prev?.rows || emptyList), ...parsed]
    return {
      rows,
      columns:
        queryResultsOutput.ResultSet?.ResultSetMetadata?.ColumnInfo?.map(
          ({ Name, Type }) => ({
            name: Name,
            type: Type,
          }),
        ) || emptyColumns,
      next: queryResultsOutput.NextToken,
      queryExecution,
    }
  } catch (error) {
    return {
      rows: emptyList,
      columns: emptyColumns,
      queryExecution: {
        ...queryExecution,
        error: error instanceof Error ? error : new Error(`${error}`),
      },
    }
  }
}

export function useQueryResults(
  queryExecutionId: string | null,
  prev: QueryResultsResponse | null,
): AsyncData<QueryResultsResponse> {
  const athena = AWS.Athena.use()
  return useData(
    fetchQueryResults,
    { athena, prev, queryExecutionId },
    { noAutoFetch: !queryExecutionId },
  )
}

export interface QueryRunResponse {
  id: string
}

interface RunQueryArgs {
  athena: Athena
  queryBody: string
  workgroup: string
}

export async function runQuery({
  athena,
  queryBody,
  workgroup,
}: RunQueryArgs): Promise<QueryRunResponse> {
  try {
    const { QueryExecutionId } = await athena
      .startQueryExecution({
        QueryString: queryBody,
        ResultConfiguration: {
          EncryptionConfiguration: {
            EncryptionOption: 'SSE_S3',
          },
        },
        WorkGroup: workgroup,
      })
      .promise()
    if (!QueryExecutionId) throw new Error('No execution id')
    return {
      id: QueryExecutionId,
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.log('Unable to fetch')
    // eslint-disable-next-line no-console
    console.error(e)
    throw e
  }
}

export function useQueryRun(workgroup: string): (q: string) => Promise<QueryRunResponse> {
  const athena = AWS.Athena.use()
  return React.useCallback(
    (queryBody: string) => {
      if (!athena) return Promise.reject(new Error('No Athena available'))
      return runQuery({ athena, queryBody, workgroup })
    },
    [athena, workgroup],
  )
}
