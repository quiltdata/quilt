import invariant from 'invariant'
import * as React from 'react'
import * as RRDom from 'react-router-dom'

import * as Model from 'model'

import * as requests from '../requests'

interface State {
  bucket: string
  queryExecutionId?: string
  workgroup?: string

  // TODO
  // TODO: return Error, and if some specific Error then confirm
  submit: () // workgroup: requests.athena.Workgroup,
  // queryBody: string,
  // catalogName: requests.athena.CatalogName,
  // database: requests.athena.Database,
  => void

  catalogName: Model.Value<requests.athena.CatalogName>
  catalogNames: Model.DataController<requests.athena.CatalogNamesResponse>
  database: Model.Value<requests.athena.Database>
  databases: Model.DataController<requests.athena.DatabasesResponse>
  execution: Model.Value<requests.athena.QueryExecution>
  executions: Model.DataController<requests.athena.QueryExecutionsResponse>
  queries: Model.DataController<requests.athena.QueriesResponse>
  query: Model.Value<requests.athena.AthenaQuery>
  queryBody: Model.Value<string> // No `null`?
  results: Model.DataController<requests.athena.QueryResultsResponse>
  setCatalogName: (v: requests.athena.CatalogName | null) => void
  setDatabase: (v: requests.athena.Database | null) => void
  setQuery: (v: requests.athena.AthenaQuery | null) => void
  setQueryBody: (v: string | null) => void
  workgroups: Model.DataController<requests.athena.WorkgroupsResponse>
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

  // TODO: [data, loadMore] → { data: Model.Data, loadMore }
  // TODO: [value, setValue] → { value: Model.Value, setValue }
  const workgroups = requests.athena.useWorkgroups()
  const catalogNames = requests.athena.useCatalogNames()
  const [catalogName, setCatalogName] = requests.athena.useCatalogName(catalogNames.data)
  const databases = requests.athena.useDatabases(catalogName)
  const [database, setDatabase] = requests.athena.useDatabase(databases.data)
  const queries = requests.athena.useQueries(workgroup)
  const [query, setQuery] = requests.athena.useQuery(queries.data)
  const [queryBody, setQueryBody] = requests.athena.useQueryBody(query, setQuery)
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
    submit,

    workgroups,
    executions,
    catalogName,
    catalogNames,
    database,
    databases,
    execution,
    queries,
    query,
    queryBody,
    results,
    setCatalogName,
    setDatabase,
    setQuery,
    setQueryBody,

    bucket,
    queryExecutionId,
    workgroup,
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useState = () => {
  const model = React.useContext(Ctx)
  invariant(model, 'Athena state accessed outside of provider')
  return model
}

export const use = useState
