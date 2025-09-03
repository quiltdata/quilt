import type { Athena, AWSError } from 'aws-sdk'
import * as React from 'react'
import * as Sentry from '@sentry/react'

import * as AWS from 'utils/AWS'
import * as BucketPreferences from 'utils/BucketPreferences'
import Log from 'utils/Logging'

import * as storage from './storage'
import * as Model from './utils'

export interface Query {
  // TODO: database?
  body: string
  description?: string
  key: string
  name: string
}

function parseNamedQuery(query: Athena.NamedQuery): Query {
  // TODO: database: query.Database!
  return {
    body: query.QueryString,
    description: query.Description,
    key: query.NamedQueryId!,
    name: query.Name,
  }
}

function listIncludes(list: string[], value: string): boolean {
  return list.map((x) => x.toLowerCase()).includes(value.toLowerCase())
}

export type Workgroup = string

async function fetchWorkgroup(
  athena: Athena,
  workgroup: Workgroup,
): Promise<Workgroup | null> {
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
    if (isAwsErrorAccessDenied(error)) {
      Log.info(`Fetching "${workgroup}" workgroup failed: ${error.code}`)
    } else {
      Log.error(`Fetching "${workgroup}" workgroup failed:`, error)
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
      .map(({ Name }) => Name || '')
      .filter(Boolean)
      .sort()
    const available = (
      await Promise.all(parsed.map((workgroup) => fetchWorkgroup(athena, workgroup)))
    ).filter(Boolean)
    const list = (prev?.list || []).concat(available as Workgroup[])
    return {
      list,
      next: workgroupsOutput.NextToken,
    }
  } catch (e) {
    Log.error(e)
    throw e
  }
}

export function useWorkgroups(): Model.DataController<Model.List<Workgroup>> {
  const athena = AWS.Athena.use()
  const [prev, setPrev] = React.useState<Model.List<Workgroup> | null>(null)
  const [data, setData] = React.useState<Model.Data<Model.List<Workgroup>>>()
  React.useEffect(() => {
    let mounted = true
    if (!athena) return
    fetchWorkgroups(athena, prev)
      .then((d) => mounted && setData(d))
      .catch((d) => mounted && setData(d))
    return () => {
      mounted = false
    }
  }, [athena, prev])
  return React.useMemo(() => Model.wrapData(data, setPrev), [data])
}

export function useWorkgroup(
  workgroups: Model.DataController<Model.List<Workgroup>>,
  requestedWorkgroup?: Workgroup,
  preferences?: BucketPreferences.AthenaPreferences,
): Model.DataController<Workgroup> {
  const [data, setData] = React.useState<Model.Data<Workgroup>>()
  React.useEffect(() => {
    if (!Model.hasData(workgroups.data)) return
    setData((d) => {
      // Not loaded or failed
      if (!Model.hasData(workgroups.data)) return d

      // 1: URL parameter workgroup (user navigation)
      if (requestedWorkgroup && listIncludes(workgroups.data.list, requestedWorkgroup)) {
        return requestedWorkgroup
      }

      // 2: Stored or default workgroup
      const initialWorkgroup = storage.getWorkgroup() || preferences?.defaultWorkgroup
      if (initialWorkgroup && listIncludes(workgroups.data.list, initialWorkgroup)) {
        return initialWorkgroup
      }

      // 3: First available workgroup or error
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
  id?: string
  outputBucket?: string
  query?: string
  status?: string // 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED'
  workgroup?: Athena.WorkGroupName
}

export interface QueryExecutionFailed {
  id?: string
  error: Error
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
): QueryExecutionFailed {
  return {
    error: new Error(error?.ErrorMessage || 'Unknown'),
    id: error?.QueryExecutionId,
  }
}

export type QueryExecutionsItem = QueryExecution | QueryExecutionFailed

export function useExecutions(
  workgroup: Model.Data<Workgroup>,
  queryExecutionId?: string,
): Model.DataController<Model.List<QueryExecutionsItem>> {
  const athena = AWS.Athena.use()
  const [prev, setPrev] = React.useState<Model.List<QueryExecutionsItem> | null>(null)
  const [data, setData] = React.useState<Model.Data<Model.List<QueryExecutionsItem>>>()

  React.useEffect(() => {
    if (queryExecutionId) return
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
  }, [athena, workgroup, prev, queryExecutionId])
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
        if (!rows.length) {
          setData({
            rows: [],
            columns: [],
            next,
          })
          return
        }
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
      // 1: Match execution context
      if (
        Model.hasData(execution) &&
        execution.db &&
        listIncludes(databases.list, execution.db)
      ) {
        return execution.db
      }

      // 2: Keep current selection
      if (Model.hasData(v) && listIncludes(databases.list, v)) {
        return v
      }

      // 3: Restore from storage
      const initialDatabase = storage.getDatabase()
      if (initialDatabase && listIncludes(databases.list, initialDatabase)) {
        return initialDatabase
      }

      // 4: Default to first available or null
      return databases.list[0] || null
    })
  }, [databases, execution])
  return React.useMemo(() => Model.wrapValue(value, setValue), [value])
}

function isAwsErrorAccessDenied(e: unknown): e is AWSError {
  return (
    e instanceof Error &&
    (e as Error & { code?: string }).code === 'AccessDeniedException'
  )
}

async function fetchCatalogName(
  athena: Athena,
  workgroup: Workgroup,
  catalogName: CatalogName,
): Promise<CatalogName | null> {
  // This is default place where we create tables for quilt packages
  // We show it regardless of permissions
  if (catalogName === 'AwsDataCatalog') return catalogName

  try {
    return (
      (await athena.getDataCatalog({ Name: catalogName, WorkGroup: workgroup }).promise())
        ?.DataCatalog?.Name || null
    )
  } catch (error) {
    if (isAwsErrorAccessDenied(error)) {
      Log.info(`Fetching "${catalogName}" catalog name failed: ${error.code}`)
    } else {
      Log.error(`Fetching "${catalogName}" catalog name failed:`, error)
    }
    return null
  }
}

async function fetchCatalogNames(
  athena: Athena,
  workgroup: Workgroup,
  prev: Model.List<CatalogName> | null,
): Promise<Model.List<CatalogName>> {
  try {
    const catalogsOutput = await athena
      .listDataCatalogs({ NextToken: prev?.next })
      .promise()
    const parsed = (catalogsOutput.DataCatalogsSummary || [])
      .map(({ CatalogName }) => CatalogName || '')
      .filter(Boolean)
      .sort()
    const available = (
      await Promise.all(parsed.map((name) => fetchCatalogName(athena, workgroup, name)))
    ).filter(Boolean)
    const list = (prev?.list || []).concat(available as CatalogName[])
    return {
      list,
      next: catalogsOutput.NextToken,
    }
  } catch (e) {
    Log.error(e)
    throw e
  }
}

export function useCatalogNames(
  workgroup: Model.Value<Workgroup>,
): Model.DataController<Model.List<CatalogName>> {
  const athena = AWS.Athena.use()
  const [prev, setPrev] = React.useState<Model.List<CatalogName> | null>(null)
  const [data, setData] = React.useState<Model.Data<Model.List<CatalogName>>>()
  React.useEffect(() => {
    if (!Model.hasData(workgroup)) {
      setData(workgroup || undefined)
      return
    }
    let mounted = true
    if (!athena) return
    fetchCatalogNames(athena, workgroup, prev)
      .then((d) => mounted && setData(d))
      .catch((d) => mounted && setData(d))
    return () => {
      mounted = false
    }
  }, [athena, prev, workgroup])
  return React.useMemo(() => Model.wrapData(data, setPrev), [data])
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
      // 1: Match execution context
      if (
        Model.hasData(execution) &&
        execution.catalog &&
        listIncludes(catalogNames.list, execution.catalog)
      ) {
        return execution.catalog
      }

      // 2: Keep current selection
      if (Model.hasData(v) && listIncludes(catalogNames.list, v)) {
        return v
      }

      // 3: Restore from storage
      const initialCatalogName = storage.getCatalog()
      if (initialCatalogName && listIncludes(catalogNames.list, initialCatalogName)) {
        return initialCatalogName
      }
      // 4: Default to first available or null
      return catalogNames.list[0] || null
    })
  }, [catalogNames, execution])
  return React.useMemo(() => Model.wrapValue(value, setValue), [value])
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
      // 1: Match execution query
      if (Model.hasData(execution) && execution.query) {
        const executionQuery = queries.list.find((q) => execution.query === q.body)
        return executionQuery || null
      }

      // 2: Keep current selection
      if (Model.hasData(v) && queries.list.includes(v)) {
        return v
      }

      // 3: Preserve during execution loading (prevents flickering)
      if (!Model.isReady(execution)) {
        return v
      }

      // 4: Default to first available or null
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
    if (!Model.isReady(query)) {
      setValue(query)
      return
    }
    setValue((v) => {
      // 1. Error state: clear query body
      if (Model.isError(query)) return null

      // 2. Selected query: use its body content
      if (Model.hasData(query)) return query.body

      // 3. Execution context: show executed query
      if (Model.hasData(execution) && execution.query) return execution.query

      // 4. All ready but no values: set to null (clear state)
      if (!Model.isReady(v) && Model.isReady(query) && Model.isReady(execution)) {
        return null
      }

      // 5 Preserve current value
      return v
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

export interface ExecutionContext {
  catalogName: CatalogName
  database: Database
}

export const NO_DATABASE = new Error('No database')

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
}: QueryRunArgs): [
  Model.Value<QueryRun>,
  (force: boolean) => Promise<Model.Value<QueryRun>>,
] {
  const athena = AWS.Athena.use()
  // `undefined` = "is not initialized" → is not ready for run
  // `null` = is ready but not set, because not submitted for new run
  const [value, setValue] = React.useState<Model.Value<QueryRun>>()
  const prepare = React.useCallback(
    (forceDefaultExecutionContext?: boolean) => {
      if (!Model.hasData(workgroup)) {
        return new Error('No workgroup')
      }

      if (!Model.hasValue(catalogName)) {
        return catalogName
      }

      if (!Model.hasValue(database)) {
        return database
      }
      if (!database && !forceDefaultExecutionContext) {
        // We only check if database is selected,
        // because if catalogName is not selected, no databases loaded and no database selected as well
        return NO_DATABASE
      }

      if (!Model.hasData(queryBody)) {
        return queryBody
      }
      return { workgroup, catalogName, database, queryBody }
    },
    [workgroup, catalogName, database, queryBody],
  )
  React.useEffect(() => {
    const init = prepare(true)
    setValue(Model.hasData(init) ? null : undefined)
  }, [prepare])
  const run = React.useCallback(
    async (forceDefaultExecutionContext: boolean) => {
      const init = prepare(forceDefaultExecutionContext)
      if (!Model.hasData(init)) {
        // Error shouldn't be here, because we already checked for errors
        // Except `NO_DATABASE`, and if there is some mistake in code
        setValue(init)
        return init
      }

      const options: Athena.Types.StartQueryExecutionInput = {
        QueryString: init.queryBody,
        ResultConfiguration: {
          EncryptionConfiguration: {
            EncryptionOption: 'SSE_S3',
          },
        },
        WorkGroup: init.workgroup,
      }
      if (init.catalogName && init.database) {
        options.QueryExecutionContext = {
          Catalog: init.catalogName,
          Database: init.database,
        }
      }
      setValue(Model.Loading)
      try {
        const d = await athena?.startQueryExecution(options).promise()
        const { QueryExecutionId } = d || {}
        if (!QueryExecutionId) {
          const error = new Error('No execution id')
          Log.error(error)
          setValue(error)
          return error
        }
        const output = { id: QueryExecutionId }
        setValue(output)
        return output
      } catch (error) {
        if (error) {
          Log.error(error)
          if (error instanceof Error) {
            setValue(error)
          }
        }
        return error as Error
      }
    },
    [athena, prepare],
  )
  return [value, run]
}
