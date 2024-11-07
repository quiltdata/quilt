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

  /** Catalog name selected by user, or set initially */
  catalogName: Model.ValueController<requests.CatalogName>
  /** List of catalog names from Athena */
  catalogNames: Model.DataController<Model.List<requests.CatalogName>>
  /** Database selected by user, or set initially */
  database: Model.ValueController<requests.Database>
  /** List of databases from Athena */
  databases: Model.DataController<Model.List<requests.Database>>
  /**
   * Query execution loaded by id on the corresponding page.
   * On the index page (where is no queryExecutionId) it's value is null.
   */
  execution: Model.Value<requests.QueryExecution>
  /** List of query executions, in other words, history of executions */
  executions: Model.DataController<Model.List<requests.QueryExecution>>
  /** List of named queries, including query body for each query */
  queries: Model.DataController<Model.List<requests.Query>>
  /** Selected named query */
  query: Model.ValueController<requests.Query>
  /** Query body, typed by user or set from selected named query or query execution */
  queryBody: Model.ValueController<string>
  /** */
  results: Model.DataController<requests.QueryResults>
  /**
   * Workgroup selected by user explicitly or from page URL, and validated that it does exist
   * If workgroup doesn't exist, then it's value is Error
   */
  workgroup: Model.DataController<requests.Workgroup>
  /** List of workgroups from Athena */
  workgroups: Model.DataController<Model.List<requests.Workgroup>>

  /**
   * Submit query to Athena with values memoized here in state
   * If catalog name or datase is not selected, then it will return specific output.
   * Which is handled and then user can re-submit with `forceDefaultExecutionContext: true`
   */
  submit: (
    forceDefaultExecutionContext?: boolean,
  ) => Promise<Model.Value<requests.QueryRun>>

  /** If there are enough values set to run query */
  readyToRun: boolean
  /** If query is running */
  running: boolean
}

export const Ctx = React.createContext<State | null>(null)

interface ProviderProps {
  preferences?: BucketPreferences.AthenaPreferences
  children: React.ReactNode
}

export function Provider({ preferences, children }: ProviderProps) {
  const { urls } = NamedRoutes.use()

  const {
    bucket,
    queryExecutionId,
    workgroup: workgroupId,
  } = RRDom.useParams<{
    bucket: string
    queryExecutionId?: string
    workgroup?: requests.Workgroup
  }>()
  invariant(!!bucket, '`bucket` must be defined')

  const execution = requests.useWaitForQueryExecution(queryExecutionId)

  const workgroups = requests.useWorkgroups()
  const workgroup = requests.useWorkgroup(workgroups, workgroupId, preferences)
  const queries = requests.useQueries(workgroup.data)
  const query = requests.useQuery(queries.data, execution)
  const queryBody = requests.useQueryBody(query.value, query.setValue, execution)
  const catalogNames = requests.useCatalogNames()
  const catalogName = requests.useCatalogName(catalogNames.data, execution)
  const databases = requests.useDatabases(catalogName.value)
  const database = requests.useDatabase(databases.data, execution)
  const executions = requests.useExecutions(workgroup.data, queryExecutionId)
  const results = requests.useResults(execution)

  const running = React.useMemo(
    () =>
      !!queryExecutionId && (Model.isLoading(execution) || Model.isLoading(results.data)),
    [execution, queryExecutionId, results.data],
  )

  const readyToRun = React.useMemo(
    () =>
      Model.isReady(execution) &&
      Model.hasValue(catalogName.value) &&
      Model.hasValue(database.value) &&
      Model.hasData(queryBody.value),
    [execution, catalogName, database, queryBody],
  )

  const submit = requests.useQueryRun({
    workgroup: workgroup.data,
    catalogName: catalogName.value,
    database: database.value,
    queryBody: queryBody.value,
  })

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

    readyToRun,
    running,
  }

  if (Model.hasData(workgroup.data) && !workgroupId) {
    return <RRDom.Redirect to={urls.bucketAthenaWorkgroup(bucket, workgroup.data)} />
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
