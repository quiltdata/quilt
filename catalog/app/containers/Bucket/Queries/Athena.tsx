import * as R from 'ramda'
import * as React from 'react'
import { RouteComponentProps } from 'react-router'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

// FIXME: rename Fetcher components
//        move Alert and spinners to reusable components
//        show queryBody for queryExecutionId

import AthenaQueryViewer from './AthenaQueryViewer'
import ExecutionsViewer from './ExecutionsViewer'
import QueryResult from './QueryResult'
import QuerySelect from './QuerySelect'
import WorkgroupSelect from './WorkgroupSelect'
import * as requests from './requests'

const useStyles = M.makeStyles((t) => ({
  actions: {
    margin: t.spacing(2, 0),
  },
  container: {
    display: 'flex',
    padding: t.spacing(3),
  },
  form: {
    margin: t.spacing(0, 0, 4),
  },
  select: {
    margin: t.spacing(3, 0),
  },
  viewer: {
    margin: t.spacing(3, 0),
  },
}))

interface FormProps {
  disabled: boolean
  onChange: (value: string) => void
  onSubmit: (value: string) => () => void
  value: string | null
}

function Form({ disabled, value, onChange, onSubmit }: FormProps) {
  const classes = useStyles()

  return (
    <div className={classes.form}>
      <AthenaQueryViewer
        className={classes.viewer}
        onChange={onChange}
        query={value || ''}
      />

      <div className={classes.actions}>
        <M.Button
          variant="contained"
          color="primary"
          disabled={disabled}
          onClick={onSubmit(value || '')}
        >
          Run query
        </M.Button>
      </div>
    </div>
  )
}

interface SearchResultsFetcherProps {
  children: (
    props: requests.AsyncData<requests.AthenaSearchResults>,
  ) => React.ReactElement
  queryBody: string
  workgroup: string
}

function SearchResultsFetcher({
  children,
  queryBody,
  workgroup,
}: SearchResultsFetcherProps) {
  const resultsData = requests.useAthenaSearch(workgroup, queryBody)
  return children(resultsData)
}
interface QueryResultsFetcherRenderProps {
  queryResultsData: requests.AsyncData<requests.AthenaQueryResultsResults>
}

interface QueryResultsFetcherProps {
  children: (props: QueryResultsFetcherRenderProps) => React.ReactElement
  queryExecutionId: string | null
}

function QueryResultsFetcher({ children, queryExecutionId }: QueryResultsFetcherProps) {
  const queryResultsData = requests.useQueryResults(queryExecutionId)
  return children({ queryResultsData })
}

interface QueriesFetcherRenderProps {
  executionsData: requests.AsyncData<requests.QueryExecution[]>
  queriesData: requests.AsyncData<requests.AthenaQuery[]>
}

interface QueriesFetcherProps {
  children: (props: QueriesFetcherRenderProps) => React.ReactElement
  workgroup: string
}

function QueriesFetcher({ children, workgroup }: QueriesFetcherProps) {
  const queriesData = requests.useNamedQueries(workgroup)
  const executionsData = requests.useQueryExecutions(workgroup)
  return children({ queriesData, executionsData })
}

interface QueriesStateRenderProps {
  customQueryBody: string | null
  executionsData: requests.AsyncData<requests.QueryExecution[]>
  handleQueryBodyChange: (q: string | null) => void
  handleQueryMetaChange: (q: requests.Query | requests.AthenaQuery | null) => void
  handleSubmit: (q: string) => () => void
  handleWorkgroupChange: (w: requests.Workgroup | null) => void
  queriesData: requests.AsyncData<requests.AthenaQuery[]>
  queryMeta: requests.AthenaQuery | null
  queryResultsData: requests.AsyncData<requests.AthenaQueryResultsResults>
  resultsData: requests.AsyncData<requests.AthenaSearchResults>
  workgroup: requests.Workgroup | null
  workgroups: requests.Workgroup[]
}

interface QueriesStateProps {
  children: (props: QueriesStateRenderProps) => React.ReactElement
  queryExecutionId: string | null
}

function QueriesState({ children, queryExecutionId }: QueriesStateProps) {
  const classes = useStyles()

  // Info about query: name, url, etc.
  const [queryMeta, setQueryMeta] = React.useState<requests.AthenaQuery | null>(null)

  // Custom query content, not associated with queryMeta
  const [customQueryBody, setCustomQueryBody] = React.useState<string | null>(null)

  const handleQueryMetaChange = React.useCallback(
    (query) => {
      setQueryMeta(query as requests.AthenaQuery | null)
      setCustomQueryBody(null)
    },
    [setQueryMeta, setCustomQueryBody],
  )

  // Query content requested to Elastic Search
  const [queryRequest, setQueryRequest] = React.useState<string | null>(null)

  const handleSubmit = React.useMemo(
    () => (body: string) => () => setQueryRequest(body),
    [setQueryRequest],
  )

  const workgroupsData = requests.useAthenaWorkgroups()

  const [workgroup, setWorkgroup] = React.useState<requests.Workgroup | null>(null)
  const handleWorkgroupChange = React.useCallback(
    (w) => {
      setWorkgroup(w)
    },
    [setWorkgroup],
  )

  return workgroupsData.case({
    Ok: (workgroups) => (
      <QueryResultsFetcher queryExecutionId={queryExecutionId}>
        {({ queryResultsData }) => (
          <QueriesFetcher workgroup={workgroup?.name || workgroups?.[0].name || ''}>
            {({ queriesData, executionsData }) => (
              <SearchResultsFetcher
                queryBody={queryRequest || ''}
                workgroup={workgroup?.name || workgroups?.[0].name || ''}
              >
                {(resultsData) =>
                  children({
                    customQueryBody,
                    executionsData,
                    handleQueryBodyChange: setCustomQueryBody,
                    handleQueryMetaChange,
                    handleSubmit,
                    handleWorkgroupChange,
                    queriesData,
                    queryMeta,
                    queryResultsData,
                    resultsData,
                    workgroup: workgroup || workgroups?.[0],
                    workgroups,
                  })
                }
              </SearchResultsFetcher>
            )}
          </QueriesFetcher>
        )}
      </QueryResultsFetcher>
    ),
    Err: (requestError: Error) => (
      <div className={classes.container}>
        <Lab.Alert severity="error">Workgroups Data: {requestError.message}</Lab.Alert>
      </div>
    ),
    _: () => (
      <div className={classes.container}>
        <M.CircularProgress size={48} />
      </div>
    ),
  })
}

const isButtonDisabled = (
  queryContent: string,
  resultsData: requests.AsyncData<requests.ElasticSearchResults>,
  error: Error | null,
): boolean => !!error || !queryContent || !!resultsData.case({ Pending: R.T, _: R.F })

interface AthenaProps
  extends RouteComponentProps<{ bucket: string; queryExecutionId?: string }> {}

export default function Athena({
  match: {
    params: { bucket, queryExecutionId },
  },
}: AthenaProps) {
  const classes = useStyles()

  return (
    <QueriesState queryExecutionId={queryExecutionId || null}>
      {({
        customQueryBody,
        executionsData,
        handleQueryBodyChange,
        handleQueryMetaChange,
        handleSubmit,
        handleWorkgroupChange,
        queriesData,
        queryMeta,
        queryResultsData,
        resultsData,
        workgroup,
        workgroups,
      }) => (
        <div>
          <M.Typography variant="h6">Athena SQL</M.Typography>
          <WorkgroupSelect
            className={classes.select}
            workgroups={workgroups}
            onChange={handleWorkgroupChange}
            value={workgroup}
          />

          {queriesData.case({
            Ok: (queries) => (
              <QuerySelect
                className={classes.select}
                queries={queries}
                onChange={handleQueryMetaChange}
                value={customQueryBody ? null : queryMeta}
              />
            ),
            Err: (error: Error) => (
              <Lab.Alert severity="error">QueryesData: {error.message}</Lab.Alert>
            ),
            _: () => (
              <M.Box pt={5} textAlign="center">
                <M.CircularProgress size={96} />
              </M.Box>
            ),
          })}

          <Form
            disabled={isButtonDisabled(
              customQueryBody || queryMeta?.body || '',
              resultsData,
              null,
            )}
            onChange={handleQueryBodyChange}
            onSubmit={handleSubmit}
            value={customQueryBody || queryMeta?.body || ''}
          />

          {executionsData.case({
            Ok: (executions) => (
              <ExecutionsViewer bucket={bucket} executions={executions} />
            ),
            Err: (error: Error) => (
              <Lab.Alert severity="error">Executions Data:{error.message}</Lab.Alert>
            ),
            _: () => (
              <M.Box pt={5} textAlign="center">
                <M.CircularProgress size={96} />
              </M.Box>
            ),
          })}

          {queryResultsData.case({
            Init: () => null,
            Ok: (queryResults: requests.AthenaQueryResultsResults) => (
              <QueryResult results={queryResults} />
            ),
            Err: (error: Error) => (
              <Lab.Alert severity="error">Query Results Data: {error.message}</Lab.Alert>
            ),
            _: () => (
              <M.Box pt={5} textAlign="center">
                <M.CircularProgress size={96} />
              </M.Box>
            ),
          })}
        </div>
      )}
    </QueriesState>
  )
}
