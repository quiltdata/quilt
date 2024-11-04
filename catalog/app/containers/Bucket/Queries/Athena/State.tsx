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
  catalogNames: Model.DataController<requests.athena.CatalogNamesResponse>
  database: Model.ValueController<requests.athena.Database>
  databases: Model.DataController<requests.athena.DatabasesResponse>
  execution: Model.Value<requests.athena.QueryExecution>
  executions: Model.DataController<requests.athena.QueryExecutionsResponse>
  queries: Model.DataController<requests.athena.QueriesResponse>
  query: Model.ValueController<requests.athena.AthenaQuery>
  queryBody: Model.ValueController<string> // No `null`, simple `useState<string>('')` ?
  results: Model.DataController<requests.athena.QueryResultsResponse>
  workgroups: Model.DataController<requests.athena.WorkgroupsResponse>

  // TODO
  // TODO: return Error, and if some specific Error then confirm
  submit: () // workgroup: requests.athena.Workgroup,
  // queryBody: string,
  // catalogName: requests.athena.CatalogName,
  // database: requests.athena.Database,
  => void
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

  const submit = () => {
    //console.log('SUBMIT', {
    //  workgroup,
    //  queryBody,
    //  catalogName,
    //  database,
    //})
  }

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
