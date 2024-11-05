import Athena from 'aws-sdk/clients/athena'
import * as React from 'react'

import * as AWS from 'utils/AWS'
import * as BucketPreferences from 'utils/BucketPreferences'

import * as Model from '../Athena/model'

import * as storage from './storage'

// TODO: rename to requests.athena.Query
export interface AthenaQuery {
  body: string
  description?: string
  key: string
  name: string
}

function parseNamedQuery(query: Athena.NamedQuery): AthenaQuery {
  return {
    body: query.QueryString,
    description: query.Description,
    key: query.NamedQueryId!,
    name: query.Name,
  }
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
    const parsed = (workgroupsOutput.WorkGroups || [])
      .map(({ Name }) => Name || 'Unknown')
      .sort()
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

export function useWorkgroups(): Model.DataController<WorkgroupsResponse> {
  const athena = AWS.Athena.use()
  const [prev, setPrev] = React.useState<WorkgroupsResponse | null>(null)
  const [data, setData] = React.useState<Model.Data<WorkgroupsResponse>>()
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
  React.useEffect(() => {
    if (!athena) return
    fetchWorkgroups({ athena, prev, preferences }).then(setData).catch(setData)
  }, [athena, prev, preferences])
  return React.useMemo(() => wrapData(data, setPrev), [data])
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

export function useExecutions(
  workgroup?: string,
): Model.DataController<Model.List<QueryExecution>> {
  const athena = AWS.Athena.use()
  const [prev, setPrev] = React.useState<Model.List<QueryExecution> | null>(null)
  const [data, setData] = React.useState<Model.Data<Model.List<QueryExecution>>>()

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
          setData({
            list: [],
            next,
          })
          return
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
  return React.useMemo(() => wrapData(data, setPrev), [data])
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
    const request = athena?.getQueryExecution({ QueryExecutionId }, (err, d) => {
      const { QueryExecution } = d || {}
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
    })
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
    if (Model.isReady(data) && timer) {
      clearInterval(timer)
    }
  }, [timer, data])
  return data
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
  rows: QueryResultsRows
}

type ManifestKey = 'hash' | 'logical_key' | 'meta' | 'physical_keys' | 'size'

export interface QueryManifestsResponse extends QueryResultsResponse {
  rows: [ManifestKey[], ...string[][]]
}

const emptyRow: Row = []
const emptyList: QueryResultsRows = []
const emptyColumns: QueryResultsColumns = []

// TODO: rename to `QueryRun`
export interface QueryRunResponse {
  id: string
}

export type CatalogName = string

export type Database = string

export type QueryId = string
export interface QueriesIdsResponse {
  list: QueryId[]
  next?: string
}

export function useQueries(
  workgroup?: string,
): Model.DataController<Model.List<AthenaQuery>> {
  const athena = AWS.Athena.use()
  const [prev, setPrev] = React.useState<Model.List<AthenaQuery> | null>(null)
  const [data, setData] = React.useState<Model.Data<Model.List<AthenaQuery>>>()
  React.useEffect(() => {
    if (!workgroup) return
    setData(Model.Loading)

    let batchRequest: ReturnType<InstanceType<typeof Athena>['batchGetNamedQuery']>
    const request = athena?.listNamedQueries(
      {
        WorkGroup: workgroup,
        NextToken: prev?.next,
      },
      async (err, d) => {
        const { NamedQueryIds, NextToken: next } = d || {}
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
          (batchErr, batchData) => {
            const { NamedQueries } = batchData || {}
            if (batchErr) {
              setData(batchErr)
              return
            }
            const parsed = (NamedQueries || [])
              .map(parseNamedQuery)
              .sort((a, b) => a.name.localeCompare(b.name))
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
  return React.useMemo(() => wrapData(data, setPrev), [data])
}

export function useResults(
  execution: Model.Value<QueryExecution>,
): Model.DataController<QueryResultsResponse> {
  const athena = AWS.Athena.use()
  const [prev, setPrev] = React.useState<QueryResultsResponse | null>(null)
  const [data, setData] = React.useState<Model.Data<QueryResultsResponse>>()

  React.useEffect(() => {
    if (execution === null) {
      setData(undefined)
      return
    }
    if (!Model.hasValue(execution)) {
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
        })
      },
    )
    return () => request?.abort()
  }, [athena, execution, prev])
  return React.useMemo(() => wrapData(data, setPrev), [data])
}

export function useDatabases(
  catalogName: Model.Value<CatalogName>,
): Model.DataController<Model.List<Database>> {
  const athena = AWS.Athena.use()
  const [prev, setPrev] = React.useState<Model.List<Database> | null>(null)
  const [data, setData] = React.useState<Model.Data<Model.List<Database>>>()
  React.useEffect(() => {
    if (!Model.hasData(catalogName)) {
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
        const list = DatabaseList?.map(({ Name }) => Name || 'Unknown').sort() || []
        setData({ list: (prev?.list || []).concat(list), next })
      },
    )
    return () => request?.abort()
  }, [athena, catalogName, prev])
  return React.useMemo(() => wrapData(data, setPrev), [data])
}

function wrapValue<T>(
  value: Model.Value<T>,
  setValue: (d: T | null) => void,
): Model.ValueController<T> {
  return {
    value,
    setValue,
  }
}

function wrapData<T>(
  data: Model.Data<T>,
  setPrev: (d: T) => void,
): Model.DataController<T> {
  return {
    data,
    loadMore: () => Model.hasData(data) && setPrev(data),
  }
}

export function useCatalogNames(): Model.DataController<Model.List<CatalogName>> {
  const athena = AWS.Athena.use()
  const [prev, setPrev] = React.useState<Model.List<CatalogName> | null>(null)
  const [data, setData] = React.useState<Model.Data<Model.List<CatalogName>>>()
  React.useEffect(() => {
    const request = athena?.listDataCatalogs(
      { NextToken: prev?.next },
      (err, { DataCatalogsSummary, NextToken: next }) => {
        setData(Model.Loading)
        if (err) {
          setData(err)
          return
        }
        const list = DataCatalogsSummary?.map(
          ({ CatalogName }) => CatalogName || 'Unknown',
        )
        setData({
          list: (prev?.list || []).concat(list || []),
          next,
        })
      },
    )
    return () => request?.abort()
  }, [athena, prev])
  return React.useMemo(() => wrapData(data, setPrev), [data])
}

export function useQuery(
  queries: Model.Data<Model.List<AthenaQuery>>,
): Model.ValueController<AthenaQuery> {
  const [value, setValue] = React.useState<Model.Value<AthenaQuery>>()
  React.useEffect(() => {
    if (!Model.hasValue(queries)) return
    setValue((v) => {
      if (Model.hasData(v) && queries.list.includes(v)) {
        // If new queries list contains the same value, keep it
        return v
      }
      // TODO: If new queries list DOESN'T contain the same value,
      //       should be `undefined`?
      return queries.list[0] || null
    })
  }, [queries])
  return React.useMemo(() => wrapValue(value, setValue), [value])
}

export function useQueryBody(
  query: Model.Value<AthenaQuery>,
  setQuery: (value: null) => void,
): Model.ValueController<string> {
  const [value, setValue] = React.useState<Model.Value<string>>()
  React.useEffect(() => {
    if (Model.hasValue(query)) {
      setValue(query?.body || null)
    }
  }, [query])
  const handleValue = React.useCallback(
    (v: string | null) => {
      setQuery(null)
      setValue(v)
    },
    [setQuery],
  )
  return React.useMemo(() => wrapValue(value, handleValue), [value, handleValue])
}

export function useCatalogName(
  catalogNames: Model.Data<Model.List<CatalogName>>,
): Model.ValueController<CatalogName> {
  const [value, setValue] = React.useState<Model.Value<CatalogName>>()
  React.useEffect(() => {
    if (!Model.hasValue(catalogNames)) return
    setValue((v) => {
      if (Model.hasData(v) && catalogNames.list.includes(v)) {
        // If new catalog names list contains the same value, keep it
        return v
      }
      // TODO: If new catalog names list DOESN'T contain the same value,
      //       should be `undefined`?
      return catalogNames.list[0]
    })
  }, [catalogNames])
  return React.useMemo(() => wrapValue(value, setValue), [value])
}

export function useDatabase(
  databases: Model.Data<Model.List<Database>>,
): Model.ValueController<Database> {
  const [value, setValue] = React.useState<Model.Value<Database>>()
  React.useEffect(() => {
    if (Model.isError(databases)) {
      setValue(databases)
      return
    }
    if (!Model.hasValue(databases)) return
    setValue((v) => {
      if (Model.hasData(v) && databases.list.includes(v)) {
        // If new databases list contains the same value, keep it
        return v
      }
      // TODO: If new databases list DOESN'T contain the same value,
      //       should be `undefined`?
      return databases.list[0]
    })
  }, [databases])
  return React.useMemo(() => wrapValue(value, setValue), [value])
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

export const NO_CATALOG_NAME = new Error('No catalog name')
export const NO_DATABASE = new Error('No catalog name')

interface QueryRunArgs {
  workgroup?: Workgroup
  catalogName: Model.Value<CatalogName>
  database: Model.Value<Database>
  queryBody: Model.Value<string>
}
export function useQueryRun({
  workgroup,
  catalogName,
  database,
  queryBody,
}: QueryRunArgs): () => Promise<Model.Value<QueryRunResponse>> {
  const athena = AWS.Athena.use()
  return React.useCallback(
    async (forceDefaultExecutionContext?: boolean) => {
      if (!athena) return new Error('No Athena')
      if (!workgroup) return new Error('No workgroup')

      if (!Model.hasValue(catalogName)) return catalogName
      if (!catalogName && !forceDefaultExecutionContext) return NO_CATALOG_NAME

      if (!Model.hasValue(database)) return database
      if (!database && !forceDefaultExecutionContext) return NO_DATABASE

      if (!Model.hasData(queryBody)) return queryBody

      try {
        return await runQuery({
          athena,
          queryBody,
          workgroup,
          executionContext: forceDefaultExecutionContext
            ? null
            : {
                catalogName: catalogName as string,
                database: database as string,
              },
        })
      } catch (err) {
        return err instanceof Error ? err : new Error('Unknown error')
      }
    },
    [athena, workgroup, catalogName, database, queryBody],
  )
}
