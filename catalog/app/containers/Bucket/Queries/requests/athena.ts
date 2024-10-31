import Athena from 'aws-sdk/clients/athena'
import * as React from 'react'

import * as Model from 'model'
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
  try {
    const workgroupOutput = await athena.getWorkGroup({ WorkGroup: workgroup }).promise()
    if (
      workgroupOutput?.WorkGroup?.Configuration?.ResultConfiguration?.OutputLocation &&
      workgroupOutput?.WorkGroup?.State === 'ENABLED' &&
      workgroupOutput?.WorkGroup?.Name
    ) {
      return workgroupOutput.WorkGroup.Name
    }
    return null
  } catch (error) {
    if ((error as $TSFixMe).code === 'AccessDeniedException') {
      // eslint-disable-next-line no-console
      console.info(
        `Fetching "${workgroup}" workgroup failed: ${(error as $TSFixMe).code}`,
      )
    } else {
      // eslint-disable-next-line no-console
      console.error(`Fetching "${workgroup}" workgroup failed:`, error)
    }
    return null
  }
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
  const prefs = BucketPreferences.use()
  const preferences = React.useMemo(
    () =>
      BucketPreferences.Result.match(
        {
          Ok: ({ ui }) => ui.athena,
          _: () => undefined,
        },
        prefs,
      ),
    [prefs],
  )
  return useData(fetchWorkgroups, { athena, prev, preferences })
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

export function useExecutionsCancelable(
  workgroup?: string,
): [Model.Data<QueryExecutionsResponse>, () => void] {
  const athena = AWS.Athena.use()
  const [prev, setPrev] = React.useState<QueryExecutionsResponse | null>(null)
  const [data, setData] = React.useState<Model.Data<QueryExecutionsResponse>>()

  React.useEffect(() => {
    if (!workgroup) return
    setData(Model.Loading)
    let batchRequest: ReturnType<InstanceType<typeof Athena>['batchGetQueryExecution']>

    const request = athena?.listQueryExecutions(
      { WorkGroup: workgroup, NextToken: prev?.next },
      (err, { QueryExecutionIds, NextToken: next }) => {
        if (err) {
          setData(err)
          return
        }
        if (!QueryExecutionIds || !QueryExecutionIds.length) {
          return {
            list: [],
            next,
          }
        }
        batchRequest = athena?.batchGetQueryExecution(
          { QueryExecutionIds },
          (batchErr, { QueryExecutions, UnprocessedQueryExecutionIds }) => {
            if (batchErr) {
              setData(batchErr)
              return
            }
            const parsed = (QueryExecutions || [])
              .map(parseQueryExecution)
              .concat((UnprocessedQueryExecutionIds || []).map(parseQueryExecutionError))
            const list = (prev?.list || []).concat(parsed)
            return {
              list,
              next,
            }
          },
        )
      },
    )
    return () => {
      request?.abort()
      batchRequest?.abort()
    }
  }, [athena, workgroup, prev])
  const loadMore = React.useCallback(
    () => Model.isFulfilled(data) && setPrev(data),
    [data],
  )
  return [data, loadMore]
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

function useFetchQueryExecution(
  QueryExecutionId?: string,
): [Model.Value<QueryExecution>, () => void] {
  const athena = AWS.Athena.use()
  const [data, setData] = React.useState<Model.Value<QueryExecution>>(
    QueryExecutionId ? undefined : null,
  )
  const [counter, setCounter] = React.useState(0)
  React.useEffect(() => {
    if (!QueryExecutionId) {
      // setData(null)
      return
    }
    setData(Model.Loading)
    const request = athena?.getQueryExecution(
      { QueryExecutionId },
      (err, { QueryExecution }) => {
        if (err) {
          setData(err)
          return
        }
        const status = QueryExecution?.Status?.State
        const parsed = QueryExecution
          ? parseQueryExecution(QueryExecution)
          : { id: QueryExecutionId }
        switch (status) {
          case 'FAILED':
          case 'CANCELLED': {
            const reason = QueryExecution?.Status?.StateChangeReason || ''
            setData(new Error(`${status}: ${reason}`))
            break
          }
          case 'SUCCEEDED':
            setData(parsed)
            break
          case 'QUEUED':
          case 'RUNNING':
            // eslint-disable-next-line no-await-in-loop
            // await wait(1000)
            break
          default:
            setData(new Error('Unknown query execution status'))
            break
        }
      },
    )
    return () => request?.abort()
  }, [athena, QueryExecutionId, counter])
  const fetch = React.useCallback(() => setCounter((prev) => prev + 1), [])
  return [data, fetch]
}

export function useWaitForQueryExecution(
  queryExecutionId?: string,
): Model.Value<QueryExecution> {
  const [data, fetch] = useFetchQueryExecution(queryExecutionId)
  const [timer, setTimer] = React.useState<NodeJS.Timer | null>(null)
  React.useEffect(() => {
    const t = setInterval(fetch, 1000)
    setTimer(t)
    return () => clearInterval(t)
  }, [fetch])
  React.useEffect(() => {
    if (Model.isFulfilled(data) && timer) {
      clearInterval(timer)
    }
  }, [timer, data])
  return data
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
    switch (status) {
      case 'FAILED':
      case 'CANCELLED': {
        const reason = statusData?.QueryExecution?.Status?.StateChangeReason || ''
        return {
          ...parsed,
          error: new Error(`${status}: ${reason}`),
        }
      }
      case 'SUCCEEDED':
        return parsed
      case 'QUEUED':
      case 'RUNNING':
        // eslint-disable-next-line no-await-in-loop
        await wait(1000)
        break
      default:
        return {
          ...parsed,
          error: new Error('Unknown query execution status'),
        }
    }
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

type ManifestKey = 'hash' | 'logical_key' | 'meta' | 'physical_keys' | 'size'

export interface QueryManifestsResponse extends QueryResultsResponse {
  rows: [ManifestKey[], ...string[][]]
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
    const columns =
      queryResultsOutput.ResultSet?.ResultSetMetadata?.ColumnInfo?.map(
        ({ Name, Type }) => ({
          name: Name,
          type: Type,
        }),
      ) || emptyColumns
    const isHeadColumns = columns.every(({ name }, index) => name === rows[0][index])
    return {
      rows: isHeadColumns ? rows.slice(1) : rows,
      columns,
      next: queryResultsOutput.NextToken,
      queryExecution,
    }
  } catch (error) {
    // TODO: return error instead of emptyList and emptyColumns
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

export type CatalogName = string
export interface CatalogNamesResponse {
  list: CatalogName[]
  next?: string
}

interface CatalogNamesArgs {
  athena: Athena
  prev?: CatalogNamesResponse
}

async function fetchCatalogNames({
  athena,
  prev,
}: CatalogNamesArgs): Promise<CatalogNamesResponse> {
  const catalogsOutput = await athena
    ?.listDataCatalogs({ NextToken: prev?.next })
    .promise()
  const list =
    catalogsOutput?.DataCatalogsSummary?.map(
      ({ CatalogName }) => CatalogName || 'Unknown',
    ) || []
  return {
    list: (prev?.list || []).concat(list),
    next: catalogsOutput.NextToken,
  }
}

export function useCatalogNames(
  prev: CatalogNamesResponse | null,
): AsyncData<CatalogNamesResponse> {
  const athena = AWS.Athena.use()
  return useData(fetchCatalogNames, { athena, prev })
}

export type Database = string
export interface DatabasesResponse {
  list: CatalogName[]
  next?: string
}

interface DatabasesArgs {
  athena: Athena
  catalogName: CatalogName
  prev?: DatabasesResponse
}

async function fetchDatabases({
  athena,
  catalogName,
  prev,
}: DatabasesArgs): Promise<DatabasesResponse> {
  const databasesOutput = await athena
    ?.listDatabases({ CatalogName: catalogName, NextToken: prev?.next })
    .promise()
  // TODO: add `Description` besides `Name`
  const list = databasesOutput?.DatabaseList?.map(({ Name }) => Name || 'Unknown') || []
  return {
    list: (prev?.list || []).concat(list),
    next: databasesOutput.NextToken,
  }
}

export type QueryId = string
export interface QueriesIdsResponse {
  list: QueryId[]
  next?: string
}

export function useQueriesCancelable(
  workgroup?: string,
): [Model.Data<QueriesResponse>, () => void] {
  const athena = AWS.Athena.use()
  const [prev, setPrev] = React.useState<QueriesResponse | null>(null)
  const [data, setData] = React.useState<Model.Data<QueriesResponse>>()
  React.useEffect(() => {
    if (!workgroup) return
    setData(Model.Loading)

    let batchRequest: ReturnType<InstanceType<typeof Athena>['batchGetNamedQuery']>
    const request = athena?.listNamedQueries(
      {
        WorkGroup: workgroup,
        NextToken: prev?.next,
      },
      async (err, { NamedQueryIds, NextToken: next }) => {
        if (err) {
          setData(err)
          return
        }
        if (!NamedQueryIds || !NamedQueryIds.length) {
          setData({
            list: prev?.list || [],
            next,
          })
          return
        }
        batchRequest = athena?.batchGetNamedQuery(
          { NamedQueryIds },
          (batchErr, { NamedQueries }) => {
            if (batchErr) {
              setData(batchErr)
              return
            }
            const parsed = (NamedQueries || []).map(parseNamedQuery)
            const list = (prev?.list || []).concat(parsed)
            setData({
              list,
              next,
            })
          },
        )
      },
    )
    return () => {
      request?.abort()
      batchRequest?.abort()
    }
  }, [athena, workgroup, prev])
  const loadMore = React.useCallback(
    () => Model.isFulfilled(data) && setPrev(data),
    [data],
  )
  return [data, loadMore]
}

export function useResultsCancelable(
  execution: Model.Value<QueryExecution>,
): [Model.Data<QueryResultsResponse>, () => void] {
  const athena = AWS.Athena.use()
  const [prev, setPrev] = React.useState<QueryResultsResponse | null>(null)
  const [data, setData] = React.useState<Model.Data<QueryResultsResponse>>()

  React.useEffect(() => {
    if (execution === null) {
      setData(undefined)
      return
    }
    if (!Model.isFulfilled(execution)) {
      setData(execution)
      return
    }
    if (!execution.id) {
      setData(new Error('Query execution has no ID'))
      return
    }

    const request = athena?.getQueryResults(
      { QueryExecutionId: execution.id, NextToken: prev?.next },
      (err, { ResultSet, NextToken: next }) => {
        if (err) {
          setData(err)
          return
        }
        const parsed =
          ResultSet?.Rows?.map(
            (row) => row?.Data?.map((item) => item?.VarCharValue || '') || emptyRow,
          ) || emptyList
        const rows = [...(prev?.rows || emptyList), ...parsed]
        const columns =
          ResultSet?.ResultSetMetadata?.ColumnInfo?.map(({ Name, Type }) => ({
            name: Name,
            type: Type,
          })) || emptyColumns
        const isHeadColumns = columns.every(({ name }, index) => name === rows[0][index])
        setData({
          rows: isHeadColumns ? rows.slice(1) : rows,
          columns,
          next,
          queryExecution: execution,
        })
      },
    )
    return () => request?.abort()
  }, [athena, execution, prev])
  const loadMore = React.useCallback(
    () => Model.isFulfilled(data) && setPrev(data),
    [data],
  )
  return [data, loadMore]
}

export function useDatabasesCancelable(
  catalogName: Model.Value<CatalogName>,
): [Model.Data<DatabasesResponse>, () => void] {
  const athena = AWS.Athena.use()
  const [prev, setPrev] = React.useState<DatabasesResponse | null>(null)
  const [data, setData] = React.useState<Model.Data<DatabasesResponse>>()
  React.useEffect(() => {
    if (!Model.isSelected(catalogName)) {
      // TODO: setData(undefined)?
      return
    }
    setData(Model.Loading)
    const request = athena?.listDatabases(
      {
        CatalogName: catalogName,
        NextToken: prev?.next,
      },
      (err, { DatabaseList, NextToken: next }) => {
        if (err) {
          setData(err)
          return
        }
        const list = DatabaseList?.map(({ Name }) => Name || 'Unknown') || []
        setData({ list: (prev?.list || []).concat(list), next })
      },
    )
    return () => request?.abort()
  }, [athena, catalogName, prev])
  const loadMore = React.useCallback(
    () => Model.isFulfilled(data) && setPrev(data),
    [data],
  )
  return [data, loadMore]
}

export function useCatalogNamesCancelable(): [
  Model.Data<CatalogNamesResponse>,
  () => void,
] {
  const athena = AWS.Athena.use()
  const [prev, setPrev] = React.useState<CatalogNamesResponse | null>(null)
  const [value, setValue] = React.useState<Model.Data<CatalogNamesResponse>>()
  React.useEffect(() => {
    const request = athena?.listDataCatalogs({ NextToken: prev?.next }, (err, data) => {
      setValue(Model.Loading)
      if (err) {
        setValue(err)
        return
      }
      const list = data?.DataCatalogsSummary?.map(
        ({ CatalogName }) => CatalogName || 'Unknown',
      )
      setValue({
        list: (prev?.list || []).concat(list || []),
        next: data.NextToken,
      })
    })
    return () => request?.abort()
  }, [athena, prev])
  const loadMore = React.useCallback(
    () => Model.isFulfilled(value) && setPrev(value),
    [value],
  )
  return [value, loadMore]
}

export function useQuery(
  queries: Model.Data<QueriesResponse>,
): [Model.Value<AthenaQuery>, (value: AthenaQuery | null) => void] {
  const [value, setValue] = React.useState<Model.Value<AthenaQuery>>()
  React.useEffect(() => {
    if (!Model.isFulfilled(queries)) return
    setValue((v) => {
      if (Model.isSelected(v) && queries.list.includes(v)) {
        // If new queries list contains the same value, keep it
        return v
      }
      // TODO: If new queries list DOESn't contain the same value,
      //       should be `undefined`?
      return queries.list[0]
    })
  }, [queries])
  return [value, setValue]
}

export function useQueryBody(
  query: Model.Value<AthenaQuery>,
  setQuery: (value: null) => void,
): [Model.Value<string>, (value: string | null) => void] {
  const [value, setValue] = React.useState<Model.Value<string>>()
  React.useEffect(() => {
    if (!Model.isSelected(query)) return
    // Override querybody every type query changed/selected
    // if (typeof value === 'undefined')
    setValue(query.body)
    // }
  }, [query])
  const handleValue = React.useCallback(
    (v: string | null) => {
      setQuery(null)
      setValue(v)
    },
    [setQuery],
  )
  return [value, handleValue]
}

export function useCatalogName(
  catalogNames: Model.Data<CatalogNamesResponse>,
): [Model.Value<CatalogName>, (value: CatalogName | null) => void] {
  const [value, setValue] = React.useState<Model.Value<CatalogName>>()
  React.useEffect(() => {
    if (!Model.isFulfilled(catalogNames)) return
    setValue((v) => {
      if (Model.isSelected(v) && catalogNames.list.includes(v)) {
        // If new catalog names list contains the same value, keep it
        return v
      }
      // TODO: If new catalog names list DOESn't contain the same value,
      //       should be `undefined`?
      return catalogNames.list[0]
    })
  }, [catalogNames])
  return [value, setValue]
}

export function useDatabase(
  databases: Model.Data<DatabasesResponse>,
): [Model.Value<Database>, (value: Database | null) => void] {
  const [value, setValue] = React.useState<Model.Value<Database>>()
  React.useEffect(() => {
    if (Model.isError(databases)) {
      setValue(databases)
      return
    }
    if (!Model.isFulfilled(databases)) return
    setValue((v) => {
      if (Model.isSelected(v) && databases.list.includes(v)) {
        // If new databases list contains the same value, keep it
        return v
      }
      // TODO: If new databases list DOESn't contain the same value,
      //       should be `undefined`?
      return databases.list[0]
    })
  }, [databases])
  return [value, setValue]
}

export function useDatabases(
  catalogName: CatalogName | null,
  prev: DatabasesResponse | null,
): AsyncData<DatabasesResponse> {
  const athena = AWS.Athena.use()
  return useData(
    fetchDatabases,
    { athena, catalogName, prev },
    { noAutoFetch: !catalogName },
  )
}

interface DefaultDatabaseArgs {
  athena: Athena
}

async function fetchDefaultQueryExecution({
  athena,
}: DefaultDatabaseArgs): Promise<QueryExecution | null> {
  const catalogNames = await fetchCatalogNames({ athena })
  if (!catalogNames.list.length) {
    return null
  }
  const catalogName = catalogNames.list[0]
  const databases = await fetchDatabases({ athena, catalogName })
  if (!databases.list.length) {
    return null
  }
  return {
    catalog: catalogName,
    db: databases.list[0],
  }
}

export function useDefaultQueryExecution(): AsyncData<QueryExecution> {
  const athena = AWS.Athena.use()
  return useData(fetchDefaultQueryExecution, { athena })
}

export interface ExecutionContext {
  catalogName: CatalogName
  database: Database
}

interface RunQueryArgs {
  athena: Athena
  queryBody: string
  workgroup: string
  executionContext: ExecutionContext | null
}

export async function runQuery({
  athena,
  queryBody,
  workgroup,
  executionContext,
}: RunQueryArgs): Promise<QueryRunResponse> {
  try {
    const options: Athena.Types.StartQueryExecutionInput = {
      QueryString: queryBody,
      ResultConfiguration: {
        EncryptionConfiguration: {
          EncryptionOption: 'SSE_S3',
        },
      },
      WorkGroup: workgroup,
    }
    if (executionContext) {
      options.QueryExecutionContext = {
        Catalog: executionContext.catalogName,
        Database: executionContext.database,
      }
    }
    const { QueryExecutionId } = await athena.startQueryExecution(options).promise()
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

export function useQueryRun(workgroup: string) {
  const athena = AWS.Athena.use()
  return React.useCallback(
    (queryBody: string, executionContext: ExecutionContext | null) => {
      if (!athena) return Promise.reject(new Error('No Athena available'))
      return runQuery({ athena, queryBody, workgroup, executionContext })
    },
    [athena, workgroup],
  )
}
