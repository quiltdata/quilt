import * as R from 'ramda'
import * as React from 'react'
import { RouteComponentProps } from 'react-router'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import * as Sentry from 'utils/Sentry'

import * as requests from './requests'
import AthenaQueryViewer from './AthenaQueryViewer'
import AthenaResults from './AthenaResults'
import ExecutionsViewer from './ExecutionsViewer'
import QuerySelect from './QuerySelect'
import WorkgroupSelect from './WorkgroupSelect'

interface AlertProps {
  error: Error
  title: string
}

function Alert({ error, title }: AlertProps) {
  const sentry = Sentry.use()
  sentry('captureException', error)

  return (
    <Lab.Alert severity="error">
      {title}: {error.message}
    </Lab.Alert>
  )
}

function makeAsyncDataErrorHandler(title: string) {
  return (error: Error) => <Alert error={error} title={title} />
}

interface SpinnerProps {
  padding?: number
  size?: 'large'
}

function Spinner({ padding, size }: SpinnerProps) {
  return (
    <M.Box pt={padding || 5} textAlign="center">
      <M.CircularProgress size={size === 'large' ? 96 : 48} />
    </M.Box>
  )
}

function makeAsyncDataPendingHandler({ padding, size }: SpinnerProps = {}) {
  return () => <Spinner padding={padding} size={size} />
}

const useStyles = M.makeStyles((t) => ({
  actions: {
    margin: t.spacing(2, 0),
  },
  executions: {
    margin: t.spacing(0, 0, 4),
  },
  form: {
    margin: t.spacing(0, 0, 4),
  },
  results: {
    margin: t.spacing(4, 0, 0),
  },
  select: {
    flexBasis: '50%',
    '& + &': {
      marginLeft: t.spacing(3),
    },
  },
  selects: {
    display: 'flex',
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

interface QueryRunnerRenderProps {
  queryRunData: requests.AsyncData<requests.athena.QueryRunResponse>
}

interface QueryRunnerProps {
  children: (props: QueryRunnerRenderProps) => React.ReactElement
  queryBody: string
  workgroup: string
}

function QueryRunner({ children, queryBody, workgroup }: QueryRunnerProps) {
  const queryRunData = requests.athena.useQueryRun(workgroup, queryBody)
  return children({ queryRunData })
}
interface QueryResultsFetcherRenderProps {
  queryResultsData: requests.AsyncData<requests.athena.QueryResultsResponse>
}

interface QueryResultsFetcherProps {
  children: (props: QueryResultsFetcherRenderProps) => React.ReactElement
  queryExecutionId: string | null
}

function QueryResultsFetcher({ children, queryExecutionId }: QueryResultsFetcherProps) {
  const queryResultsData = requests.athena.useQueryResults(queryExecutionId)
  return children({ queryResultsData })
}

interface QueriesFetcherRenderProps {
  executionsData: requests.AsyncData<requests.athena.QueryExecution[]>
  queriesData: requests.AsyncData<requests.athena.AthenaQuery[]>
}

interface QueriesFetcherProps {
  children: (props: QueriesFetcherRenderProps) => React.ReactElement
  workgroup: string
}

function QueriesFetcher({ children, workgroup }: QueriesFetcherProps) {
  const queriesData = requests.athena.useQueries(workgroup)
  const executionsData = requests.athena.useQueryExecutions(workgroup)
  return children({ queriesData, executionsData })
}

interface QueriesStateRenderProps {
  customQueryBody: string | null
  executionsData: requests.AsyncData<requests.athena.QueryExecution[]>
  handleQueryBodyChange: (q: string | null) => void
  handleQueryMetaChange: (q: requests.Query | requests.athena.AthenaQuery | null) => void
  handleSubmit: (q: string) => () => void
  handleWorkgroupChange: (w: requests.athena.Workgroup | null) => void
  handleWorkgroupsLoadMore: (w: requests.athena.WorkgroupsResponse) => void
  queriesData: requests.AsyncData<requests.athena.AthenaQuery[]>
  queryMeta: requests.athena.AthenaQuery | null
  queryResultsData: requests.AsyncData<requests.athena.QueryResultsResponse>
  queryRunData: requests.AsyncData<requests.athena.QueryRunResponse>
  workgroup: requests.athena.Workgroup | null
  workgroups: requests.athena.WorkgroupsResponse
}

interface QueriesStateProps {
  children: (props: QueriesStateRenderProps) => React.ReactElement
  queryExecutionId: string | null
}

function QueriesState({ children, queryExecutionId }: QueriesStateProps) {
  // Info about query: name, url, etc.
  const [queryMeta, setQueryMeta] = React.useState<requests.athena.AthenaQuery | null>(
    null,
  )

  // Custom query content, not associated with queryMeta
  const [customQueryBody, setCustomQueryBody] = React.useState<string | null>(null)

  const handleQueryMetaChange = React.useCallback(
    (query) => {
      setQueryMeta(query as requests.athena.AthenaQuery | null)
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

  const [
    workgroupsPrev,
    setWorkgroupsPrev,
  ] = React.useState<requests.athena.WorkgroupsResponse | null>(null)
  const workgroupsData = requests.athena.useWorkgroups(workgroupsPrev)

  const [workgroup, setWorkgroup] = React.useState<requests.athena.Workgroup | null>(null)
  const handleWorkgroupChange = React.useCallback(
    (w) => {
      setWorkgroup(w)
    },
    [setWorkgroup],
  )

  const handleWorkgroupsLoadMore = (workgroups: requests.athena.WorkgroupsResponse) => {
    setWorkgroupsPrev(workgroups)
  }

  return workgroupsData.case({
    Ok: (workgroups) => (
      <QueryResultsFetcher queryExecutionId={queryExecutionId}>
        {({ queryResultsData }) =>
          queryResultsData.case({
            Pending: makeAsyncDataPendingHandler(),
            _: ({ queryExecution }) => (
              <QueriesFetcher
                workgroup={
                  workgroup?.name ||
                  queryExecution?.WorkGroup ||
                  workgroups?.list?.[0].name ||
                  ''
                }
              >
                {({ queriesData, executionsData }) => (
                  <QueryRunner
                    queryBody={queryRequest || ''}
                    workgroup={workgroup?.name || workgroups?.list?.[0].name || ''}
                  >
                    {({ queryRunData }) =>
                      children({
                        customQueryBody: customQueryBody || queryExecution?.Query || null,
                        executionsData,
                        handleQueryBodyChange: setCustomQueryBody,
                        handleQueryMetaChange,
                        handleSubmit,
                        handleWorkgroupChange,
                        handleWorkgroupsLoadMore,
                        queriesData,
                        queryMeta,
                        queryResultsData,
                        queryRunData,
                        workgroup:
                          workgroup ||
                          (queryExecution?.WorkGroup && {
                            key: queryExecution?.WorkGroup,
                            name: queryExecution?.WorkGroup,
                          }) ||
                          workgroups?.defaultWorkgroup,
                        workgroups,
                      })
                    }
                  </QueryRunner>
                )}
              </QueriesFetcher>
            ), // FIXME: avoid repetition
            Ok: ({ queryExecution }) => (
              <QueriesFetcher
                workgroup={
                  workgroup?.name ||
                  queryExecution?.WorkGroup ||
                  workgroups?.list?.[0].name ||
                  ''
                }
              >
                {({ queriesData, executionsData }) => (
                  <QueryRunner
                    queryBody={queryRequest || ''}
                    workgroup={
                      workgroup?.name || workgroups?.defaultWorkgroup?.name || ''
                    }
                  >
                    {({ queryRunData }) =>
                      children({
                        customQueryBody: customQueryBody || queryExecution?.Query || null,
                        executionsData,
                        handleQueryBodyChange: setCustomQueryBody,
                        handleQueryMetaChange,
                        handleSubmit,
                        handleWorkgroupChange,
                        handleWorkgroupsLoadMore,
                        queriesData,
                        queryMeta,
                        queryResultsData,
                        queryRunData,
                        workgroup:
                          workgroup ||
                          (queryExecution?.WorkGroup && {
                            key: queryExecution?.WorkGroup,
                            name: queryExecution?.WorkGroup,
                          }) ||
                          workgroups?.defaultWorkgroup,
                        workgroups,
                      })
                    }
                  </QueryRunner>
                )}
              </QueriesFetcher>
            ),
            Err: makeAsyncDataErrorHandler('Query Results'),
          })
        }
      </QueryResultsFetcher>
    ),
    Err: makeAsyncDataErrorHandler('Workgroups Data'),
    _: makeAsyncDataPendingHandler(),
  })
}

const isButtonDisabled = (
  queryContent: string,
  resultsData: requests.AsyncData<requests.ElasticSearchResults>, // FIXME
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
        handleWorkgroupsLoadMore,
        queriesData,
        queryMeta,
        queryResultsData,
        queryRunData,
        workgroup,
        workgroups,
      }) => (
        <div>
          <M.Typography variant="h6">Athena SQL</M.Typography>

          <div className={classes.selects}>
            <div className={classes.select}>
              <WorkgroupSelect
                workgroups={workgroups}
                onChange={handleWorkgroupChange}
                onLoadMore={handleWorkgroupsLoadMore}
                value={workgroup}
              />
            </div>

            <div className={classes.select}>
              {queriesData.case({
                Ok: (queries) => (
                  <QuerySelect
                    className={classes.select}
                    queries={queries}
                    onChange={handleQueryMetaChange}
                    value={customQueryBody ? null : queryMeta}
                  />
                ),
                Err: makeAsyncDataErrorHandler('Select query'),
                _: makeAsyncDataPendingHandler({ padding: 2 }),
              })}
            </div>
          </div>

          <Form
            disabled={isButtonDisabled(
              customQueryBody || queryMeta?.body || '',
              queryRunData,
              null,
            )}
            onChange={handleQueryBodyChange}
            onSubmit={handleSubmit}
            value={customQueryBody || queryMeta?.body || ''}
          />

          {executionsData.case({
            Ok: (executions) => (
              <ExecutionsViewer
                className={classes.executions}
                bucket={bucket}
                executions={executions}
              />
            ),
            Err: makeAsyncDataErrorHandler('Executions Data'),
            _: makeAsyncDataPendingHandler({ size: 'large' }),
          })}

          {queryResultsData.case({
            Init: () => null,
            Ok: (queryResults: requests.athena.QueryResultsResponse) => (
              <AthenaResults results={queryResults.queryResults} />
            ),
            Err: makeAsyncDataErrorHandler('Query Results Data'),
            _: makeAsyncDataPendingHandler({ size: 'large' }),
          })}
        </div>
      )}
    </QueriesState>
  )
}
