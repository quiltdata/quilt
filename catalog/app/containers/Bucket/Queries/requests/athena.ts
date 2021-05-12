import Athena from 'aws-sdk/clients/athena'

import * as AWS from 'utils/AWS'
import { useData } from 'utils/Data'

import { AsyncData } from './requests'

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

async function fetchQueries({
  athena,
  prev,
  workgroup,
}: QueriesArgs): Promise<QueriesResponse> {
  try {
    const queryIdsOutput = await athena
      ?.listNamedQueries({ MaxResults: 2, WorkGroup: workgroup, NextToken: prev?.next })
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
    const parsed = (queriesOutput.NamedQueries || []).map((query) => ({
      body: query.QueryString,
      description: query.Description,
      key: query.NamedQueryId!,
      name: query.Name,
    }))
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

export interface Workgroup {
  key: string // for consistency
  name: string
}

export type WorkgroupsResponse = {
  defaultWorkgroup: Workgroup
  list: Workgroup[]
  next?: string
}

interface WorkgroupsArgs {
  athena: Athena
  prev: WorkgroupsResponse | null
}

async function fetchWorkgroups({
  athena,
  prev,
}: WorkgroupsArgs): Promise<WorkgroupsResponse> {
  try {
    const workgroupsOutput = await athena
      .listWorkGroups({ NextToken: prev?.next })
      .promise()
    const parsed = (workgroupsOutput.WorkGroups || []).map(({ Name }) => ({
      key: Name || 'Unknown', // for consistency
      name: Name || 'Unknown',
    }))
    const list = (prev?.list || []).concat(parsed)
    return {
      defaultWorkgroup: list[0], // TODO: get default from config
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
  return useData(fetchWorkgroups, { athena, prev })
}

interface QueryExecutionsArgs {
  athena: Athena
  workgroup: string
}

export interface QueryExecution {
  catalog?: string
  completed?: Date
  created?: Date
  db?: string
  id?: string
  outputBucket?: string
  query?: string
  status?: string // 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED'
}

type QueryExecutionsResponse = QueryExecution[]

async function fetchQueryExecutions({
  athena,
  workgroup,
}: QueryExecutionsArgs): Promise<QueryExecutionsResponse> {
  try {
    const executionIdsData = await athena
      .listQueryExecutions({ WorkGroup: workgroup })
      .promise()

    if (!executionIdsData.QueryExecutionIds || !executionIdsData.QueryExecutionIds.length)
      return []

    const executionsData = await athena
      ?.batchGetQueryExecution({ QueryExecutionIds: executionIdsData.QueryExecutionIds })
      .promise()
    return (executionsData.QueryExecutions || []).map((queryExecution) => ({
      catalog: queryExecution?.QueryExecutionContext?.Catalog,
      completed: queryExecution?.Status?.CompletionDateTime,
      created: queryExecution?.Status?.SubmissionDateTime,
      db: queryExecution?.QueryExecutionContext?.Database,
      id: queryExecution?.QueryExecutionId,
      outputBucket: queryExecution?.ResultConfiguration?.OutputLocation,
      query: queryExecution?.Query,
      status: queryExecution?.Status?.State,
    }))
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
): AsyncData<QueryExecutionsResponse> {
  const athena = AWS.Athena.use()
  return useData(fetchQueryExecutions, { athena, workgroup })
}

async function waitForQueryStatus(
  athena: Athena,
  QueryExecutionId: string,
): Promise<Athena.QueryExecution | null> {
  const statusData = await athena.getQueryExecution({ QueryExecutionId }).promise()
  const status = statusData?.QueryExecution?.Status?.State
  if (status === 'FAILED' || status === 'CANCELLED') {
    throw new Error(status)
  }

  if (status === 'SUCCEEDED') {
    return statusData?.QueryExecution || null
  }

  return waitForQueryStatus(athena, QueryExecutionId)
}

export type QueryResults = Athena.GetQueryResultsOutput

export type QueryResultsResponse = {
  queryExecution: Athena.QueryExecution | null
  queryResults: Athena.GetQueryResultsOutput
}

async function fetchQueryResults({
  athena,
  queryExecutionId,
}: {
  athena: Athena
  queryExecutionId: string
}): Promise<QueryResultsResponse> {
  const queryExecution = await waitForQueryStatus(athena, queryExecutionId)

  const queryResults = await athena
    .getQueryResults({ QueryExecutionId: queryExecutionId })
    .promise()
  return {
    queryExecution,
    queryResults,
  }
}

export function useQueryResults(
  queryExecutionId: string | null,
): AsyncData<QueryResultsResponse> {
  const athena = AWS.Athena.use()
  return useData(
    fetchQueryResults,
    { athena, queryExecutionId },
    { noAutoFetch: !queryExecutionId },
  )
}

async function hashQueryBody(queryBody: string, workgroup: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(workgroup + queryBody)
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
  return hashHex
}

export interface QueryRunResponse {
  id: string
}

interface RunQueryArgs {
  athena: Athena
  queryBody: string
  workgroup: string
}

async function runQuery({
  athena,
  queryBody,
  workgroup,
}: RunQueryArgs): Promise<QueryRunResponse> {
  try {
    const hashDigest = await hashQueryBody(queryBody, workgroup)
    const { QueryExecutionId } = await athena
      .startQueryExecution({
        ClientRequestToken: hashDigest,
        QueryString: queryBody,
        ResultConfiguration: {
          EncryptionConfiguration: {
            EncryptionOption: 'SSE_S3',
          },
          // OutputLocation: 's3://fiskus-sandbox-dev/fiskus/sandbox/'
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

export function useQueryRun(
  workgroup: string,
  queryBody: string,
): AsyncData<QueryRunResponse> {
  const athena = AWS.Athena.use()
  return useData(runQuery, { athena, queryBody, workgroup }, { noAutoFetch: !queryBody })
}
