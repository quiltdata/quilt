import Athena from 'aws-sdk/clients/athena'
import * as React from 'react'
import * as Sentry from '@sentry/react'

import * as AWS from 'utils/AWS'
import * as BucketPreferences from 'utils/BucketPreferences'

import * as storage from './storage'
import * as Model from './utils'

export interface Query {
  body: string
  description?: string
  key: string
  name: string
}

function parseNamedQuery(query: Athena.NamedQuery): Query {
  return {
    body: query.QueryString,
    description: query.Description,
    key: query.NamedQueryId!,
    name: query.Name,
  }
}

export type Workgroup = string

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

async function fetchWorkgroups(
  athena: Athena,
  prev: Model.List<Workgroup> | null,
): Promise<Model.List<Workgroup>> {
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

export function useWorkgroups(): Model.DataController<Model.List<Workgroup>> {
  const athena = AWS.Athena.use()
  const [prev, setPrev] = React.useState<Model.List<Workgroup> | null>(null)
  const [data, setData] = React.useState<Model.Data<Model.List<Workgroup>>>()
  React.useEffect(() => {
    if (!athena) return
    fetchWorkgroups(athena, prev).then(setData).catch(setData)
  }, [athena, prev])
  return React.useMemo(() => Model.wrapData(data, setPrev), [data])
}

export function useWorkgroup(
  workgroups: Model.DataController<Model.List<Workgroup>>,
  requestedWorkgroup?: Workgroup,
  preferences?: BucketPreferences.AthenaPreferences,
): Model.DataController<CatalogName> {
  const [data, setData] = React.useState<Model.Data<Workgroup>>()
  React.useEffect(() => {
    if (!Model.hasData(workgroups.data)) return
    setData((d) => {
      if (!Model.hasData(workgroups.data)) return d
      if (requestedWorkgroup && workgroups.data.list.includes(requestedWorkgroup)) {
        return requestedWorkgroup
      }
      const initialWorkgroup = storage.getWorkgroup() || preferences?.defaultWorkgroup
      if (initialWorkgroup && workgroups.data.list.includes(initialWorkgroup)) {
        return initialWorkgroup
      }
      return workgroups.data.list[0] || new Error('Workgroup not found')
    })
  }, [preferences, requestedWorkgroup, workgroups])
  return React.useMemo(
    () => Model.wrapData(data, workgroups.loadMore),
    [data, workgroups.loadMore],
  )
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
  workgroup: Model.Data<Workgroup>,
): Model.DataController<Model.List<QueryExecution>> {
  const athena = AWS.Athena.use()
  const [prev, setPrev] = React.useState<Model.List<QueryExecution> | null>(null)
  const [data, setData] = React.useState<Model.Data<Model.List<QueryExecution>>>()

  React.useEffect(() => {
    if (!Model.hasValue(workgroup)) {
      setData(workgroup)
      return
    }
    setData(Model.Loading)
    let batchRequest: ReturnType<InstanceType<typeof Athena>['batchGetQueryExecution']>

    const request = athena?.listQueryExecutions(
      { WorkGroup: workgroup, NextToken: prev?.next },
      (error, d) => {
        const { QueryExecutionIds, NextToken: next } = d || {}
        if (error) {
          Sentry.captureException(error)
          setData(error)
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
          (batchErr, batchData) => {
            const { QueryExecutions, UnprocessedQueryExecutionIds } = batchData || {}
            if (batchErr) {
              Sentry.captureException(batchErr)
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
  return React.useMemo(() => Model.wrapData(data, setPrev), [data])
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
      setData(null)
      return
    }
    setData(Model.Loading)
    const request = athena?.getQueryExecution({ QueryExecutionId }, (error, d) => {
      const { QueryExecution } = d || {}
      if (error) {
        Sentry.captureException(error)
        setData(error)
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
  }, [queryExecutionId, fetch])
  React.useEffect(() => {
    if (Model.isReady(data) && timer) {
      clearInterval(timer)
    }
  }, [timer, data])
  return data
}

export type QueryResultsValue = Athena.datumString

interface QueryResultsColumnInfo<T> {
  name: T
  type: Athena.String
}

export type QueryResultsColumns<T = Athena.String> = QueryResultsColumnInfo<T>[]
type Row = QueryResultsValue[]
export type QueryResultsRows = Row[]

export interface QueryResults {
  columns: QueryResultsColumns
  next?: string
  rows: QueryResultsRows
}

export type ManifestKey =
  | 'hash'
  | 'logical_key'
  | 'meta'
  | 'physical_key'
  | 'physical_keys'
  | 'size'

export interface QueryManifests extends QueryResults {
  columns: QueryResultsColumns<ManifestKey>
}

const emptyRow: Row = []
const emptyList: QueryResultsRows = []
const emptyColumns: QueryResultsColumns = []

export interface QueryRun {
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
  workgroup: Model.Data<Workgroup>,
): Model.DataController<Model.List<Query>> {
  const athena = AWS.Athena.use()
  const [prev, setPrev] = React.useState<Model.List<Query> | null>(null)
  const [data, setData] = React.useState<Model.Data<Model.List<Query>>>()
  React.useEffect(() => {
    if (!Model.hasValue(workgroup)) {
      setData(workgroup)
      return
    }
    setData(Model.Loading)

    let batchRequest: ReturnType<InstanceType<typeof Athena>['batchGetNamedQuery']>
    const request = athena?.listNamedQueries(
      {
        WorkGroup: workgroup,
        NextToken: prev?.next,
      },
      async (error, d) => {
        const { NamedQueryIds, NextToken: next } = d || {}
        if (error) {
          Sentry.captureException(error)
          setData(error)
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
              Sentry.captureException(batchErr)
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
  return React.useMemo(() => Model.wrapData(data, setPrev), [data])
}

export function useResults(
  execution: Model.Value<QueryExecution>,
): Model.DataController<QueryResults> {
  const athena = AWS.Athena.use()
  const [prev, setPrev] = React.useState<QueryResults | null>(null)
  const [data, setData] = React.useState<Model.Data<QueryResults>>()

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
      (error, d) => {
        const { ResultSet, NextToken: next } = d || {}
        if (error) {
          Sentry.captureException(error)
          setData(error)
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
  return React.useMemo(() => Model.wrapData(data, setPrev), [data])
}

export function useDatabases(
  catalogName: Model.Value<CatalogName>,
): Model.DataController<Model.List<Database>> {
  const athena = AWS.Athena.use()
  const [prev, setPrev] = React.useState<Model.List<Database> | null>(null)
  const [data, setData] = React.useState<Model.Data<Model.List<Database>>>()
  React.useEffect(() => {
    if (!Model.hasData(catalogName)) {
      setData(catalogName || undefined)
      return
    }
    setData(Model.Loading)
    const request = athena?.listDatabases(
      {
        CatalogName: catalogName,
        NextToken: prev?.next,
      },
      (error, d) => {
        const { DatabaseList, NextToken: next } = d || {}
        if (error) {
          Sentry.captureException(error)
          setData(error)
          return
        }
        const list = DatabaseList?.map(({ Name }) => Name || 'Unknown').sort() || []
        setData({ list: (prev?.list || []).concat(list), next })
      },
    )
    return () => request?.abort()
  }, [athena, catalogName, prev])
  return React.useMemo(() => Model.wrapData(data, setPrev), [data])
}

export function useCatalogNames(): Model.DataController<Model.List<CatalogName>> {
  const athena = AWS.Athena.use()
  const [prev, setPrev] = React.useState<Model.List<CatalogName> | null>(null)
  const [data, setData] = React.useState<Model.Data<Model.List<CatalogName>>>()
  React.useEffect(() => {
    const request = athena?.listDataCatalogs({ NextToken: prev?.next }, (error, d) => {
      const { DataCatalogsSummary, NextToken: next } = d || {}
      setData(Model.Loading)
      if (error) {
        Sentry.captureException(error)
        setData(error)
        return
      }
      const list = DataCatalogsSummary?.map(({ CatalogName }) => CatalogName || 'Unknown')
      setData({
        list: (prev?.list || []).concat(list || []),
        next,
      })
    })
    return () => request?.abort()
  }, [athena, prev])
  return React.useMemo(() => Model.wrapData(data, setPrev), [data])
}

export function useQuery(
  queries: Model.Data<Model.List<Query>>,
  execution: Model.Value<QueryExecution>,
): Model.ValueController<Query> {
  const [value, setValue] = React.useState<Model.Value<Query>>()
  React.useEffect(() => {
    if (!Model.hasData(queries)) {
      setValue(queries)
      return
    }
    setValue((v) => {
      if (Model.hasData(execution) && execution.query) {
        const executionQuery = queries.list.find((q) => execution.query === q.body)
        return executionQuery || null
      }
      if (Model.hasData(v) && queries.list.includes(v)) {
        return v
      }
      return queries.list[0] || null
    })
  }, [execution, queries])
  return React.useMemo(() => Model.wrapValue(value, setValue), [value])
}

export function useQueryBody(
  query: Model.Value<Query>,
  setQuery: (value: null) => void,
  execution: Model.Value<QueryExecution>,
): Model.ValueController<string> {
  const [value, setValue] = React.useState<Model.Value<string>>()
  React.useEffect(() => {
    setValue(() => {
      if (Model.isError(query)) return null
      if (Model.hasData(query)) return query.body
      if (Model.hasData(execution) && execution.query) return execution.query
      return query
    })
  }, [execution, query])
  const handleValue = React.useCallback(
    (v: string | null) => {
      setQuery(null)
      setValue(v)
    },
    [setQuery],
  )
  return React.useMemo(() => Model.wrapValue(value, handleValue), [value, handleValue])
}

export function useCatalogName(
  catalogNames: Model.Data<Model.List<CatalogName>>,
  execution: Model.Value<QueryExecution>,
): Model.ValueController<CatalogName> {
  const [value, setValue] = React.useState<Model.Value<CatalogName>>()
  React.useEffect(() => {
    if (!Model.hasData(catalogNames)) {
      setValue(catalogNames)
      return
    }
    setValue((v) => {
      if (
        Model.hasData(execution) &&
        execution.catalog &&
        catalogNames.list.includes(execution.catalog)
      ) {
        return execution.catalog
      }
      if (Model.hasData(v) && catalogNames.list.includes(v)) {
        return v
      }
      const initialCatalogName = storage.getCatalog()
      if (initialCatalogName && catalogNames.list.includes(initialCatalogName)) {
        return initialCatalogName
      }
      return catalogNames.list[0] || new Error('No catalog names')
    })
  }, [catalogNames, execution])
  return React.useMemo(() => Model.wrapValue(value, setValue), [value])
}

export function useDatabase(
  databases: Model.Data<Model.List<Database>>,
  execution: Model.Value<QueryExecution>,
): Model.ValueController<Database> {
  const [value, setValue] = React.useState<Model.Value<Database>>()
  React.useEffect(() => {
    if (!Model.hasData(databases)) {
      setValue(databases)
      return
    }
    setValue((v) => {
      if (
        Model.hasData(execution) &&
        execution.db &&
        databases.list.includes(execution.db)
      ) {
        return execution.db
      }
      if (Model.hasData(v) && databases.list.includes(v)) {
        return v
      }
      const initialDatabase = storage.getDatabase()
      if (initialDatabase && databases.list.includes(initialDatabase)) {
        return initialDatabase
      }
      return databases.list[0] || new Error('No databases')
    })
  }, [databases, execution])
  return React.useMemo(() => Model.wrapValue(value, setValue), [value])
}

export interface ExecutionContext {
  catalogName: CatalogName
  database: Database
}

interface RunQueryArgs {
  athena: Athena
  queryBody: string
  workgroup: Workgroup
  executionContext: ExecutionContext | null
}

async function runQuery({
  athena,
  queryBody,
  workgroup,
  executionContext,
}: RunQueryArgs): Promise<QueryRun> {
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
  workgroup: Model.Data<Workgroup>
  catalogName: Model.Value<CatalogName>
  database: Model.Value<Database>
  queryBody: Model.Value<string>
}
export function useQueryRun({
  workgroup,
  catalogName,
  database,
  queryBody,
}: QueryRunArgs): () => Promise<Model.Value<QueryRun>> {
  const athena = AWS.Athena.use()
  return React.useCallback(
    async (forceDefaultExecutionContext?: boolean) => {
      if (!athena) return new Error('No Athena')

      if (!Model.hasData(workgroup)) return new Error('No workgroup')

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
