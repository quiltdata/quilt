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
  catalogNames: Model.Data<requests.athena.CatalogNamesResponse>
  database: Model.Value<requests.athena.Database>
  databases: Model.Data<requests.athena.DatabasesResponse>
  execution: Model.Value<requests.athena.QueryExecution>
  executions: Model.Data<requests.athena.QueryExecutionsResponse>
  onCatalogNamesMore: () => void
  onDatabasesMore: () => void
  onExecutionsMore: () => void
  onQueriesMore: () => void
  onResultsMore: () => void
  onWorkgroupsMore: () => void
  queries: Model.Data<requests.athena.QueriesResponse>
  query: Model.Value<requests.athena.AthenaQuery>
  queryBody: Model.Value<string> // No `null`?
  results: Model.Data<requests.athena.QueryResultsResponse>
  setCatalogName: (v: requests.athena.CatalogName | null) => void
  setDatabase: (v: requests.athena.Database | null) => void
  setQuery: (v: requests.athena.AthenaQuery | null) => void
  setQueryBody: (v: string | null) => void
  workgroups: Model.Data<requests.athena.WorkgroupsResponse>
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
  const [workgroups, onWorkgroupsMore] = requests.athena.useWorkgroups()
  const [catalogNames, onCatalogNamesMore] = requests.athena.useCatalogNamesCancelable()
  const [catalogName, setCatalogName] = requests.athena.useCatalogName(catalogNames)
  const [databases, onDatabasesMore] = requests.athena.useDatabasesCancelable(catalogName)
  const [database, setDatabase] = requests.athena.useDatabase(databases)
  const [queries, onQueriesMore] = requests.athena.useQueriesCancelable(workgroup)
  const [query, setQuery] = requests.athena.useQuery(queries)
  const [queryBody, setQueryBody] = requests.athena.useQueryBody(query, setQuery)
  const [executions, onExecutionsMore] =
    requests.athena.useExecutionsCancelable(workgroup)
  const [results, onResultsMore] = requests.athena.useResultsCancelable(execution)

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
    onWorkgroupsMore,
    executions,
    onExecutionsMore,
    catalogName,
    catalogNames,
    database,
    databases,
    execution,
    onCatalogNamesMore,
    onDatabasesMore,
    onQueriesMore,
    onResultsMore,
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
