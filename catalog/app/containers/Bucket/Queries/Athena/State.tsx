import invariant from 'invariant'
import * as React from 'react'
import * as RRDom from 'react-router-dom'

import * as requests from '../requests'

import * as Model from './model'

interface State {
  bucket: string
  queryExecutionId?: string
  workgroup?: string

  catalogName: Model.ValueController<requests.athena.CatalogName>
  catalogNames: Model.DataController<Model.List<requests.athena.CatalogName>>
  database: Model.ValueController<requests.athena.Database>
  databases: Model.DataController<Model.List<requests.athena.Database>>
  execution: Model.Value<requests.athena.QueryExecution>
  executions: Model.DataController<Model.List<requests.athena.QueryExecution>>
  queries: Model.DataController<Model.List<requests.athena.AthenaQuery>>
  query: Model.ValueController<requests.athena.AthenaQuery>
  queryBody: Model.ValueController<string> // No `null`, simple `useState<string>('')` ?
  results: Model.DataController<requests.athena.QueryResultsResponse>
  workgroups: Model.DataController<requests.athena.WorkgroupsResponse>

  // TODO
  // TODO: return Error, and if some specific Error then confirm
  submit: (
    forceDefaultExecutionContext?: boolean, // workgroup: requests.athena.Workgroup,
  ) => Promise<Model.Value<requests.athena.QueryRunResponse>>
}

const Ctx = React.createContext<State | null>(null)

interface ProviderProps {
  children: React.ReactNode
}

export function Provider({ children }: ProviderProps) {
  const { bucket, queryExecutionId, workgroup } = RRDom.useParams<{
    bucket: string
    queryExecutionId?: string
    workgroup?: requests.athena.Workgroup
  }>()
  invariant(!!bucket, '`bucket` must be defined')

  const execution = requests.athena.useWaitForQueryExecution(queryExecutionId)

  const workgroups = requests.athena.useWorkgroups()
  const catalogNames = requests.athena.useCatalogNames()
  const catalogName = requests.athena.useCatalogName(catalogNames.data)
  const databases = requests.athena.useDatabases(catalogName.value)
  const database = requests.athena.useDatabase(databases.data)
  const queries = requests.athena.useQueries(workgroup)
  const query = requests.athena.useQuery(queries.data)
  const queryBody = requests.athena.useQueryBody(query.value, query.setValue)
  const executions = requests.athena.useExecutions(workgroup)
  const results = requests.athena.useResults(execution)

  const submit = requests.athena.useQueryRun({
    workgroup: workgroup,
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
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useState = () => {
  const model = React.useContext(Ctx)
  invariant(model, 'Athena state accessed outside of provider')
  return model
}

export const use = useState
