import invariant from 'invariant'
import * as React from 'react'
import * as RRDom from 'react-router-dom'

import type * as BucketPreferences from 'utils/BucketPreferences'
import * as NamedRoutes from 'utils/NamedRoutes'

import * as requests from './requests'
import * as Model from './utils'

export interface State {
  bucket: string
  queryExecutionId?: string

  /**
   * Query execution loaded by id on the corresponding page.
   * On the index page (where there is no queryExecutionId) its value is null.
   */
  execution: Model.Value<requests.QueryExecution>

  /** List of workgroups from Athena */
  workgroups: Model.DataController<Model.List<requests.Workgroup>>
  /**
   * Workgroup selected by user explicitly or from page URL, and validated that it does exist
   * If workgroup doesn't exist, then its value is Error
   * It can't be null
   */
  workgroup: Model.Data<requests.Workgroup>
  /** List of named queries, including query body for each query */
  queries: Model.DataController<Model.List<requests.Query>>
  /** Selected named query */
  query: Model.ValueController<requests.Query>
  /** Query body, typed by user or set from selected named query or query execution */
  queryBody: Model.ValueController<string>
  /** List of catalog names from Athena */
  catalogNames: Model.DataController<Model.List<requests.CatalogName>>
  /** Catalog name selected by user, or set initially */
  catalogName: Model.ValueController<requests.CatalogName>
  /** List of databases from Athena */
  databases: Model.DataController<Model.List<requests.Database>>
  /** Database selected by user, or set initially */
  database: Model.ValueController<requests.Database>
  /** List of query executions, in other words, history of executions */
  executions: Model.DataController<Model.List<requests.QueryExecutionsItem>>
  /** Rows and columns of query results */
  results: Model.DataController<requests.QueryResults>

  /**
   * Submit query to Athena with values memoized here in state
   * If catalog name or database is not selected, then it will return specific output
   * Which is handled and then user can re-submit with `forceDefaultExecutionContext: true`
   */
  submit: (
    forceDefaultExecutionContext: boolean,
  ) => Promise<Model.Value<requests.QueryRun>>
  /**
   * Query run is `undefined` when there is not enough data to run the query
   * It is `null` when it is ready to run
   * Error when submit failed or when validation failed (e.g. no database selected)
   */
  queryRun: Model.Value<requests.QueryRun>

  /** URL generators */
  toWorkgroup: (workgroup: string) => string
  toExecution: (executionId: string) => string
}

export const Ctx = React.createContext<State | null>(null)

interface ProviderProps {
  bucket: string
  children: React.ReactNode
  preferences?: BucketPreferences.AthenaPreferences
  queryExecutionId?: string
  workgroupId?: requests.Workgroup
}

export function Provider({
  bucket,
  preferences,
  queryExecutionId,
  workgroupId,
  children,
}: ProviderProps) {
  const { urls } = NamedRoutes.use()

  const execution = requests.useWaitForQueryExecution(queryExecutionId)

  const workgroups = requests.useWorkgroups()
  const workgroup = requests.useWorkgroup(workgroups.data, workgroupId, preferences)
  const queries = requests.useQueries(workgroup)
  const query = requests.useQuery(queries.data, execution)
  const resetQuery = React.useCallback(() => query.setValue(null), [query])
  const queryBody = requests.useQueryBody(query.value, resetQuery, execution)
  const catalogNames = requests.useCatalogNames(workgroup)
  const catalogName = requests.useCatalogName(catalogNames.data, execution)
  const databases = requests.useDatabases(catalogName.value)
  const database = requests.useDatabase(databases.data, execution)
  const executions = requests.useExecutions(workgroup, queryExecutionId)
  const results = requests.useResults(execution)

  const [queryRun, submit] = requests.useQueryRun({
    workgroup: workgroup,
    catalogName: catalogName.value,
    database: database.value,
    queryBody: queryBody.value,
  })

  const toWorkgroup = React.useCallback(
    (w: string) => urls.bucketAthenaWorkgroup(bucket, w),
    [bucket, urls],
  )
  const toExecution = React.useCallback(
    (e: string) => {
      if (!Model.hasData(workgroup)) {
        throw new Error('Workgroup not ready')
      }
      return urls.bucketAthenaExecution(bucket, workgroup.data, e)
    },
    [bucket, workgroup, urls],
  )

  const value: State = {
    bucket,
    queryExecutionId,
    workgroup,

    catalogName,
    catalogNames,
    database,
    databases,
    execution,
    executions,
    queries,
    query,
    queryBody,
    results,
    workgroups,

    submit,
    queryRun,

    toWorkgroup,
    toExecution,
  }

  if (Model.hasData(queryRun) && queryExecutionId !== queryRun.data.id) {
    return <RRDom.Redirect to={toExecution(queryRun.data.id)} />
  }

  if (Model.hasData(workgroup) && !workgroupId) {
    return <RRDom.Redirect to={toWorkgroup(workgroup.data)} />
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

/** state object is not memoized, use destructuring down to memoized properties */
export function useState() {
  const model = React.useContext(Ctx)
  invariant(model, 'Athena state accessed outside of provider')
  return model
}

export const use = useState
