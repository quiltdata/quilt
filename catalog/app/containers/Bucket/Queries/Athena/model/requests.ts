import type { Athena, AWSError } from 'aws-sdk'
import invariant from 'invariant'
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

function useAthena(): Athena {
  const athena = AWS.Athena.use()
  invariant(athena, 'Athena not available')
  return athena
}

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
  const athena = useAthena()
  const [prev, setPrev] = React.useState<Model.List<Workgroup> | null>(null)

  const requestFn = React.useCallback(() => fetchWorkgroups(athena, prev), [athena, prev])
  const requestController = Model.useRequest(requestFn)

  return React.useMemo(
    () => Model.wrapData(requestController, setPrev),
    [requestController],
  )
}

export function useWorkgroup(
  { data: workgroupsList }: Model.DataController<Model.List<Workgroup>>,
  requestedWorkgroup?: Workgroup,
  preferences?: BucketPreferences.AthenaPreferences,
): Model.Data<Workgroup> {
  return React.useMemo(() => {
    // 1. Not loaded or failed
    if (!Model.hasData(workgroupsList)) return workgroupsList

    // 2. URL parameter workgroup (user navigation)
    if (
      requestedWorkgroup &&
      listIncludes(workgroupsList.data.list, requestedWorkgroup)
    ) {
      return Model.Payload(requestedWorkgroup)
    }

    // 3. Stored or default workgroup
    const initialWorkgroup = storage.getWorkgroup() || preferences?.defaultWorkgroup
    if (initialWorkgroup && listIncludes(workgroupsList.data.list, initialWorkgroup)) {
      return Model.Payload(initialWorkgroup)
    }

    // 4. First available workgroup or error
    return workgroupsList.data.list[0]
      ? Model.Payload(workgroupsList.data.list[0])
      : Model.Err('Workgroup not found')
  }, [preferences, requestedWorkgroup, workgroupsList])
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

async function fetchExecutions(
  athena: Athena,
  workgroup: Workgroup,
  prev: Model.List<QueryExecutionsItem> | null,
  signal: AbortSignal,
): Promise<Model.List<QueryExecutionsItem>> {
  try {
    const listResult = await Model.withAbortSignal<Athena.ListQueryExecutionsOutput>(
      (callback) =>
        athena?.listQueryExecutions(
          { WorkGroup: workgroup, NextToken: prev?.next },
          callback,
        ),
      signal,
    )

    const { QueryExecutionIds, NextToken: next } = listResult || {}

    if (!QueryExecutionIds || !QueryExecutionIds.length) {
      return {
        list: [],
        next,
      }
    }

    const batchResult = await Model.withAbortSignal<Athena.BatchGetQueryExecutionOutput>(
      (callback) => athena?.batchGetQueryExecution({ QueryExecutionIds }, callback),
      signal,
    )

    const { QueryExecutions, UnprocessedQueryExecutionIds } = batchResult || {}
    const parsed = (QueryExecutions || [])
      .map(parseQueryExecution)
      .concat((UnprocessedQueryExecutionIds || []).map(parseQueryExecutionError))
    const list = (prev?.list || []).concat(parsed)

    return { list, next }
  } catch (error) {
    Sentry.captureException(error)
    throw error
  }
}

export function useExecutions(
  workgroup: Model.Data<Workgroup>,
  queryExecutionId?: string,
): Model.DataController<Model.List<QueryExecutionsItem>> {
  const athena = useAthena()
  const [prev, setPrev] = React.useState<Model.List<QueryExecutionsItem> | null>(null)

  const requestFn = React.useCallback(
    (signal: AbortSignal) => {
      invariant(Model.hasData(workgroup), 'Expected workgroup data')
      return fetchExecutions(athena, workgroup.data, prev, signal)
    },
    [athena, workgroup, prev],
  )

  const canProceed = !queryExecutionId && Model.hasData(workgroup)

  const requestController = Model.useRequest(requestFn, canProceed)

  return React.useMemo(
    () => Model.wrapData(requestController, setPrev),
    [requestController],
  )
}

async function fetchQueryExecution(
  athena: Athena,
  QueryExecutionId: string,
  signal: AbortSignal,
): Promise<QueryExecution> {
  try {
    const result = await Model.withAbortSignal<Athena.GetQueryExecutionOutput>(
      (callback) => athena?.getQueryExecution({ QueryExecutionId }, callback),
      signal,
    )

    const { QueryExecution } = result || {}
    if (!QueryExecution) {
      throw new Error('No QueryExecution data received')
    }

    const status = QueryExecution.Status?.State
    const parsed = parseQueryExecution(QueryExecution)

    switch (status) {
      case 'FAILED':
      case 'CANCELLED': {
        const reason = QueryExecution.Status?.StateChangeReason || ''
        throw new Error(`${status}: ${reason}`)
      }
      case 'SUCCEEDED':
      case 'QUEUED':
      case 'RUNNING':
        return parsed
      default:
        throw new Error('Unknown query execution status')
    }
  } catch (error) {
    Sentry.captureException(error)
    throw error
  }
}

function useFetchQueryExecution(QueryExecutionId?: string) {
  const athena = useAthena()

  const requestFn = React.useCallback(
    (signal: AbortSignal) => {
      invariant(QueryExecutionId, 'QueryExecutionId is required')
      return fetchQueryExecution(athena, QueryExecutionId, signal)
    },
    [athena, QueryExecutionId],
  )

  return Model.useRequest(requestFn, !!QueryExecutionId)
}

export function useWaitForQueryExecution(
  queryExecutionId?: string,
): Model.Value<QueryExecution> {
  const { result, refetch } = useFetchQueryExecution(queryExecutionId)
  const [timer, setTimer] = React.useState<NodeJS.Timer | null>(null)
  React.useEffect(() => {
    if (!queryExecutionId) return
    const t = setInterval(refetch, 1000)
    setTimer(t)
    return () => clearInterval(t)
  }, [queryExecutionId, refetch])
  React.useEffect(() => {
    if (!timer || (Model.hasData(result) && result.data.status !== 'SUCCEEDED')) {
      return
    }
    clearInterval(timer)
    setTimer(null)
  }, [timer, result])
  return result
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

async function fetchQueries(
  athena: Athena,
  workgroup: Workgroup,
  prev: Model.List<Query> | null,
  signal: AbortSignal,
): Promise<Model.List<Query>> {
  try {
    const listResult = await Model.withAbortSignal<Athena.ListNamedQueriesOutput>(
      (callback) =>
        athena?.listNamedQueries(
          {
            WorkGroup: workgroup,
            NextToken: prev?.next,
          },
          callback,
        ),
      signal,
    )

    const { NamedQueryIds, NextToken: next } = listResult || {}

    if (!NamedQueryIds || !NamedQueryIds.length) {
      return {
        list: prev?.list || [],
        next,
      }
    }

    const batchResult = await Model.withAbortSignal<Athena.BatchGetNamedQueryOutput>(
      (callback) => athena?.batchGetNamedQuery({ NamedQueryIds }, callback),
      signal,
    )

    const { NamedQueries } = batchResult || {}
    const parsed = (NamedQueries || [])
      .map(parseNamedQuery)
      .sort((a, b) => a.name.localeCompare(b.name))
    const list = (prev?.list || []).concat(parsed)

    return { list, next }
  } catch (error) {
    Sentry.captureException(error)
    throw error
  }
}

export function useQueries(
  workgroup: Model.Data<Workgroup>,
): Model.DataController<Model.List<Query>> {
  const athena = useAthena()
  const [prev, setPrev] = React.useState<Model.List<Query> | null>(null)

  const requestFn = React.useCallback(
    (signal: AbortSignal) => {
      invariant(Model.hasData(workgroup), 'Expected workgroup data')
      return fetchQueries(athena, workgroup.data, prev, signal)
    },
    [athena, workgroup, prev],
  )

  const requestController = Model.useRequest(requestFn, Model.hasData(workgroup))

  return React.useMemo(
    () => Model.wrapData(requestController, setPrev),
    [requestController],
  )
}

async function fetchResults(
  athena: Athena,
  queryExecutionId: string,
  prev: QueryResults | null,
  signal: AbortSignal,
): Promise<QueryResults> {
  try {
    const result = await Model.withAbortSignal<Athena.GetQueryResultsOutput>(
      (callback) =>
        athena?.getQueryResults(
          { QueryExecutionId: queryExecutionId, NextToken: prev?.next },
          callback,
        ),
      signal,
    )

    const { ResultSet, NextToken: next } = result || {}
    const parsed =
      ResultSet?.Rows?.map(
        (row) => row?.Data?.map((item) => item?.VarCharValue || '') || emptyRow,
      ) || emptyList
    const rows = [...(prev?.rows || emptyList), ...parsed]

    if (!rows.length) {
      return {
        rows: [],
        columns: [],
        next,
      }
    }

    const columns =
      ResultSet?.ResultSetMetadata?.ColumnInfo?.map(({ Name, Type }) => ({
        name: Name,
        type: Type,
      })) || emptyColumns
    const isHeadColumns = columns.every(({ name }, index) => name === rows[0][index])

    return {
      rows: isHeadColumns ? rows.slice(1) : rows,
      columns,
      next,
    }
  } catch (error) {
    Sentry.captureException(error)
    throw error
  }
}

export function useResults(
  execution: Model.Value<QueryExecution>,
): Model.DataController<QueryResults> {
  const athena = useAthena()
  const [prev, setPrev] = React.useState<QueryResults | null>(null)

  const requestFn = React.useCallback(
    (signal: AbortSignal) => {
      if (Model.isNone(execution)) {
        throw new Error('No execution provided')
      }
      if (!Model.hasValue(execution)) {
        throw new Error('Execution not ready')
      }
      if (!execution.data.id) {
        throw new Error('Query execution has no ID')
      }
      return fetchResults(athena, execution.data.id, prev, signal)
    },
    [athena, execution, prev],
  )

  const canProceed = Model.hasData(execution) && !!execution.data.id

  const requestController = Model.useRequest(requestFn, canProceed)

  return React.useMemo(
    () => Model.wrapData(requestController, setPrev),
    [requestController],
  )
}

async function fetchDatabases(
  athena: Athena,
  catalogName: CatalogName,
  prev: Model.List<Database> | null,
  signal: AbortSignal,
): Promise<Model.List<Database>> {
  try {
    const result = await Model.withAbortSignal<Athena.ListDatabasesOutput>(
      (callback) =>
        athena?.listDatabases(
          {
            CatalogName: catalogName,
            NextToken: prev?.next,
          },
          callback,
        ),
      signal,
    )

    const { DatabaseList, NextToken: next } = result || {}
    const list = DatabaseList?.map(({ Name }) => Name || 'Unknown').sort() || []

    return {
      list: (prev?.list || []).concat(list),
      next,
    }
  } catch (error) {
    Sentry.captureException(error)
    throw error
  }
}

export function useDatabases(
  catalogName: Model.Value<CatalogName>,
): Model.DataController<Model.List<Database>> {
  const athena = useAthena()
  const [prev, setPrev] = React.useState<Model.List<Database> | null>(null)

  const requestFn = React.useCallback(
    (signal: AbortSignal) => {
      invariant(Model.hasData(catalogName), 'Expected catalog name data')
      return fetchDatabases(athena, catalogName.data, prev, signal)
    },
    [athena, catalogName, prev],
  )

  const requestController = Model.useRequest(requestFn, Model.hasData(catalogName))

  return React.useMemo(
    () => Model.wrapData(requestController, setPrev),
    [requestController],
  )
}

function selectDatabase(
  databases: Model.Data<Model.List<Database>>,
  execution: Model.Value<QueryExecution>,
  currentValue: Model.Value<Database>,
): Model.Value<Database> {
  // 0. Handle not loaded/error states
  if (!Model.hasData(databases)) return databases

  // 1. Match execution context
  if (
    Model.hasData(execution) &&
    execution.data.db &&
    listIncludes(databases.data.list, execution.data.db)
  ) {
    return Model.Payload(execution.data.db)
  }

  // 2. Keep current selection
  if (
    Model.hasData(currentValue) &&
    listIncludes(databases.data.list, currentValue.data)
  ) {
    return currentValue
  }

  // 3. Restore from storage
  const initialDatabase = storage.getDatabase()
  if (initialDatabase && listIncludes(databases.data.list, initialDatabase)) {
    return Model.Payload(initialDatabase)
  }

  // 4. Default to first available or null
  return databases.data.list[0] ? Model.Payload(databases.data.list[0]) : Model.None
}

export function useDatabase(
  databases: Model.Data<Model.List<Database>>,
  execution: Model.Value<QueryExecution>,
): Model.ValueController<Database> {
  const [value, setValue] = React.useState<Model.Value<Database>>(Model.Init)

  React.useEffect(() => {
    setValue((v) => selectDatabase(databases, execution, v))
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
  const athena = useAthena()
  const [prev, setPrev] = React.useState<Model.List<CatalogName> | null>(null)

  const requestFn = React.useCallback(() => {
    invariant(Model.hasData(workgroup), 'Expected workgroup data')
    return fetchCatalogNames(athena, workgroup.data, prev)
  }, [athena, workgroup, prev])

  const requestController = Model.useRequest(requestFn, Model.hasData(workgroup))

  return React.useMemo(
    () => Model.wrapData(requestController, setPrev),
    [requestController],
  )
}

function selectCatalogName(
  catalogNames: Model.Data<Model.List<CatalogName>>,
  execution: Model.Value<QueryExecution>,
  currentValue: Model.Value<CatalogName>,
): Model.Value<CatalogName> {
  // 0. Handle not loaded/error states
  if (!Model.hasData(catalogNames)) return catalogNames

  // 1. Match execution context
  if (
    Model.hasData(execution) &&
    execution.data.catalog &&
    listIncludes(catalogNames.data.list, execution.data.catalog)
  ) {
    return Model.Payload(execution.data.catalog)
  }

  // 2. Keep current selection
  if (
    Model.hasData(currentValue) &&
    listIncludes(catalogNames.data.list, currentValue.data)
  ) {
    return currentValue
  }

  // 3. Restore from storage
  const initialCatalogName = storage.getCatalog()
  if (initialCatalogName && listIncludes(catalogNames.data.list, initialCatalogName)) {
    return Model.Payload(initialCatalogName)
  }
  // 4. Default to first available or null
  return catalogNames.data.list[0] ? Model.Payload(catalogNames.data.list[0]) : Model.None
}

export function useCatalogName(
  catalogNames: Model.Data<Model.List<CatalogName>>,
  execution: Model.Value<QueryExecution>,
): Model.ValueController<CatalogName> {
  const [value, setValue] = React.useState<Model.Value<CatalogName>>(Model.Init)

  React.useEffect(() => {
    setValue((v) => selectCatalogName(catalogNames, execution, v))
  }, [catalogNames, execution])

  return React.useMemo(() => Model.wrapValue(value, setValue), [value])
}

function selectQuery(
  queries: Model.Data<Model.List<Query>>,
  execution: Model.Value<QueryExecution>,
  currentValue: Model.Value<Query>,
): Model.Value<Query> {
  // 0. Handle not loaded/error states
  if (!Model.hasData(queries)) return queries

  // 1. Match execution query
  if (Model.hasData(execution) && execution.data.query) {
    const executionQuery = queries.data.list.find((q) => execution.data.query === q.body)
    return executionQuery ? Model.Payload(executionQuery) : Model.None
  }

  // 2. Keep current selection
  if (Model.hasData(currentValue) && queries.data.list.includes(currentValue.data)) {
    return currentValue
  }

  // 3. Preserve during execution loading (prevents flickering)
  if (!Model.isReady(execution)) {
    return currentValue
  }

  // 4. Default to first available or null
  return queries.data.list[0] ? Model.Payload(queries.data.list[0]) : Model.None
}

export function useQuery(
  queries: Model.Data<Model.List<Query>>,
  execution: Model.Value<QueryExecution>,
): Model.ValueController<Query> {
  const [value, setValue] = React.useState<Model.Value<Query>>(Model.Init)

  React.useEffect(() => {
    setValue((v) => selectQuery(queries, execution, v))
  }, [execution, queries])

  return React.useMemo(() => Model.wrapValue(value, setValue), [value])
}

export function useQueryBody(
  query: Model.Value<Query>,
  resetQuery: () => void,
  execution: Model.Value<QueryExecution>,
): Model.ValueController<string> {
  const [value, setValue] = React.useState<Model.Value<string>>(Model.Init)
  React.useEffect(() => {
    setValue((v) => {
      // 0. Handle not ready states
      if (!Model.isReady(query)) return query

      // 1. Error state: clear query body
      if (Model.isError(query)) return Model.None

      // 2. Selected query: use its body content
      if (Model.hasData(query)) return Model.Payload(query.data.body)

      // 3. Execution context: show executed query
      if (Model.hasData(execution) && execution.data.query)
        return Model.Payload(execution.data.query)

      // 4. All ready but no values: set to null (clear state)
      if (!Model.isReady(v) && Model.isReady(query) && Model.isReady(execution)) {
        return Model.None
      }

      // 5. Preserve current value
      return v
    })
  }, [execution, query])
  const handleValue = React.useCallback(
    (v: Model.Value<string>) => {
      resetQuery()
      setValue(v)
    },
    [resetQuery],
  )
  return React.useMemo(() => Model.wrapValue(value, handleValue), [value, handleValue])
}

export interface ExecutionContext {
  catalogName: CatalogName
  database: Database
}

export const NO_DATABASE = Model.Err('No database')

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
  const [value, setValue] = React.useState<Model.Value<QueryRun>>(Model.Init)
  const prepare = React.useCallback(
    (forceDefaultExecutionContext?: boolean) => {
      if (!Model.hasData(workgroup)) return Model.Err('No workgroup')
      if (!Model.hasValue(catalogName)) return catalogName
      if (!Model.hasValue(database)) return database
      if (!Model.hasData(queryBody)) return queryBody

      // We only check if database is selected,
      // because if catalogName is not selected, no databases loaded and no database selected as well
      if (!database.data && !forceDefaultExecutionContext) return NO_DATABASE

      return Model.Payload({
        workgroup: workgroup.data,
        catalogName: catalogName,
        database: database,
        queryBody: queryBody.data,
      })
    },
    [workgroup, catalogName, database, queryBody],
  )
  React.useEffect(
    () => setValue(Model.hasData(prepare(true)) ? Model.None : Model.Init),
    [prepare],
  )
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
        QueryString: init.data.queryBody,
        ResultConfiguration: {
          EncryptionConfiguration: {
            EncryptionOption: 'SSE_S3',
          },
        },
        WorkGroup: init.data.workgroup,
      }
      if (init.data.catalogName.data && init.data.database.data) {
        options.QueryExecutionContext = {
          Catalog: init.data.catalogName.data,
          Database: init.data.database.data,
        }
      }
      setValue(Model.Pending)
      try {
        const d = await athena?.startQueryExecution(options).promise()
        const { QueryExecutionId } = d || {}
        if (!QueryExecutionId) {
          const error = Model.Err('No execution id')
          Log.error(error.error)
          setValue(error)
          return error
        }
        const output = Model.Payload({ id: QueryExecutionId })
        setValue(output)
        return output
      } catch (error) {
        Log.error(error)
        const errState = Model.Err(error)
        setValue(errState)
        return errState
      }
    },
    [athena, prepare],
  )
  return [value, run]
}
