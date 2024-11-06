import invariant from 'invariant'
import * as React from 'react'
import * as RRDom from 'react-router-dom'

import * as NamedRoutes from 'utils/NamedRoutes'

import * as requests from './requests'
import * as Model from './utils'

export interface State {
  bucket: string
  queryExecutionId?: string

  catalogName: Model.ValueController<requests.CatalogName>
  catalogNames: Model.DataController<Model.List<requests.CatalogName>>
  database: Model.ValueController<requests.Database>
  databases: Model.DataController<Model.List<requests.Database>>
  execution: Model.Value<requests.QueryExecution>
  executions: Model.DataController<Model.List<requests.QueryExecution>>
  queries: Model.DataController<Model.List<requests.Query>>
  query: Model.ValueController<requests.Query>
  queryBody: Model.ValueController<string> // No `null`, simple `useState<string>('')` ?
  results: Model.DataController<requests.QueryResults>
  workgroup: Model.DataController<requests.Workgroup>
  workgroups: Model.DataController<requests.WorkgroupsResponse>

  submit: (
    forceDefaultExecutionContext?: boolean, // workgroup: requests.Workgroup,
  ) => Promise<Model.Value<requests.QueryRun>>

  readyToRun: boolean
  running: boolean
}

export const Ctx = React.createContext<State | null>(null)

interface ProviderProps {
  children: React.ReactNode
}

export function Provider({ children }: ProviderProps) {
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
  const workgroup = requests.useWorkgroup(workgroups, workgroupId)
  const queries = requests.useQueries(workgroup.data)
  const query = requests.useQuery(queries.data, execution)
  const queryBody = requests.useQueryBody(query.value, query.setValue, execution)
  const catalogNames = requests.useCatalogNames()
  const catalogName = requests.useCatalogName(catalogNames.data, execution)
  const databases = requests.useDatabases(catalogName.value)
  const database = requests.useDatabase(databases.data, execution)
  const executions = requests.useExecutions(workgroup.data)
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
export const useState = () => {
  const model = React.useContext(Ctx)
  invariant(model, 'Athena state accessed outside of provider')
  return model
}

export const use = useState
