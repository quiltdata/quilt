import * as R from 'ramda'
import * as React from 'react'
import { RouteComponentProps } from 'react-router'
import { Link, Redirect } from 'react-router-dom'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import Skeleton from 'components/Skeleton'
import * as NamedRoutes from 'utils/NamedRoutes'
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

function SelectSkeleton() {
  return (
    <>
      <Skeleton height={24} width={128} animate />
      <Skeleton height={36} mt={1} animate />
    </>
  )
}

const useFormSkeletonStyles = M.makeStyles((t) => ({
  button: {
    height: t.spacing(4),
    marginTop: t.spacing(2),
    width: t.spacing(14),
  },
  canvas: {
    flexGrow: 1,
    height: t.spacing(27),
    marginLeft: t.spacing(1),
  },
  editor: {
    display: 'flex',
    marginTop: t.spacing(1),
  },
  helper: {
    height: t.spacing(2),
    marginTop: t.spacing(1),
  },
  numbers: {
    height: t.spacing(27),
    width: t.spacing(5),
  },
  title: {
    height: t.spacing(3),
    width: t.spacing(16),
  },
}))

function FormSkeleton() {
  const classes = useFormSkeletonStyles()
  return (
    <>
      <Skeleton className={classes.title} animate />
      <div className={classes.editor}>
        <Skeleton className={classes.numbers} animate />
        <Skeleton className={classes.canvas} animate />
      </div>
      <Skeleton className={classes.helper} animate />
      <Skeleton className={classes.button} animate />
    </>
  )
}

function ExecutionsSkeleton() {
  return (
    <>
      <Skeleton height={36} animate />
      {R.range(0, 4).map((key) => (
        <Skeleton key={key} height={36} mt={1} animate />
      ))}
    </>
  )
}

function AthenaResultsSkeleton() {
  return (
    <>
      <Skeleton height={36} animate />
      {R.range(0, 10).map((key) => (
        <Skeleton key={key} height={36} mt={1} animate />
      ))}
    </>
  )
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

const useStyles = M.makeStyles((t) => ({
  emptySelect: {
    margin: t.spacing(4, 0, 0),
  },
  form: {
    margin: t.spacing(0, 0, 4),
  },
  results: {
    margin: t.spacing(4, 0, 0),
  },
  sectionHeader: {
    margin: t.spacing(0, 0, 1),
  },
  select: {
    flexBasis: '40%',
    '& + &': {
      flexBasis: '60%',
      marginLeft: t.spacing(3),
    },
  },
  selects: {
    display: 'flex',
    margin: t.spacing(3, 0),
  },
}))

const useFormStyles = M.makeStyles((t) => ({
  actions: {
    margin: t.spacing(2, 0),
  },
  viewer: {
    margin: t.spacing(3, 0, 0),
  },
}))

interface FormProps {
  disabled: boolean
  onChange: (value: string) => void
  onSubmit: (value: string) => () => void
  value: string | null
}

function Form({ disabled, value, onChange, onSubmit }: FormProps) {
  const classes = useFormStyles()

  return (
    <div>
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
  handleQueryResultsLoadMore: (prev: requests.athena.QueryResultsResponse) => void
  queryResultsData: requests.AsyncData<requests.athena.QueryResultsResponse>
}

interface QueryResultsFetcherProps {
  children: (props: QueryResultsFetcherRenderProps) => React.ReactElement
  queryExecutionId: string | null
}

function QueryResultsFetcher({ children, queryExecutionId }: QueryResultsFetcherProps) {
  const [prev, usePrev] = React.useState<requests.athena.QueryResultsResponse | null>(
    null,
  )
  const queryResultsData = requests.athena.useQueryResults(queryExecutionId, prev)
  return children({ queryResultsData, handleQueryResultsLoadMore: usePrev })
}

interface QueriesFetcherRenderProps {
  executionsData: requests.AsyncData<requests.athena.QueryExecutionsResponse>
  handleExecutionsLoadMore: (prev: requests.athena.QueryExecutionsResponse) => void
  handleQueriesLoadMore: (prev: requests.athena.QueriesResponse) => void
  queriesData: requests.AsyncData<requests.athena.QueriesResponse>
}

interface QueriesFetcherProps {
  children: (props: QueriesFetcherRenderProps) => React.ReactElement
  workgroup: string
}

function QueriesFetcher({ children, workgroup }: QueriesFetcherProps) {
  const [
    prevQueries,
    setPrevQueries,
  ] = React.useState<requests.athena.QueriesResponse | null>(null)
  const [
    prevExecutions,
    setPrevExecutions,
  ] = React.useState<requests.athena.QueryExecutionsResponse | null>(null)
  const queriesData = requests.athena.useQueries(workgroup, prevQueries)
  const executionsData = requests.athena.useQueryExecutions(workgroup, prevExecutions)
  return children({
    executionsData,
    handleExecutionsLoadMore: setPrevExecutions,
    handleQueriesLoadMore: setPrevQueries,
    queriesData,
  })
}

interface WorkgroupsFetcherRenderProps {
  workgroupsData: requests.AsyncData<requests.athena.WorkgroupsResponse>
  handleWorkgroupsLoadMore: (prev: requests.athena.WorkgroupsResponse) => void
}

interface WorkgroupsFetcherProps {
  children: (props: WorkgroupsFetcherRenderProps) => React.ReactElement
}

function WorkgroupsFetcher({ children }: WorkgroupsFetcherProps) {
  const [prev, setPrev] = React.useState<requests.athena.WorkgroupsResponse | null>(null)
  const workgroupsData = requests.athena.useWorkgroups(prev)
  return children({ handleWorkgroupsLoadMore: setPrev, workgroupsData })
}

interface QueriesStateRenderProps {
  customQueryBody: string | null
  executionsData: requests.AsyncData<requests.athena.QueryExecutionsResponse>
  handleExecutionsLoadMore: (prev: requests.athena.QueryExecutionsResponse) => void
  handleQueriesLoadMore: (prev: requests.athena.QueriesResponse) => void
  handleQueryBodyChange: (q: string | null) => void
  handleQueryMetaChange: (q: requests.Query | requests.athena.AthenaQuery | null) => void
  handleQueryResultsLoadMore: (prev: requests.athena.QueryResultsResponse) => void
  handleSubmit: (q: string) => () => void
  handleWorkgroupChange: (w: requests.athena.Workgroup | null) => void
  handleWorkgroupsLoadMore: (prev: requests.athena.WorkgroupsResponse) => void
  queriesData: requests.AsyncData<requests.athena.QueriesResponse>
  queryMeta: requests.athena.AthenaQuery | null
  queryResultsData: requests.AsyncData<requests.athena.QueryResultsResponse>
  queryRunData: requests.AsyncData<requests.athena.QueryRunResponse>
  workgroup: requests.athena.Workgroup | null
  workgroupsData: requests.AsyncData<requests.athena.WorkgroupsResponse>
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

  const [workgroup, setWorkgroup] = React.useState<requests.athena.Workgroup | null>(null)
  const handleWorkgroupChange = React.useCallback((w) => setWorkgroup(w), [setWorkgroup])
  return (
    <WorkgroupsFetcher>
      {({ handleWorkgroupsLoadMore, workgroupsData }) =>
        workgroupsData.case({
          _: ({ value: workgroups }) => (
            <QueryResultsFetcher queryExecutionId={queryExecutionId}>
              {({ queryResultsData, handleQueryResultsLoadMore }) => {
                const queryExecution = (queryResultsData as requests.AsyncData<
                  requests.athena.QueryResultsResponse,
                  requests.athena.QueryExecution | null
                >).case({
                  _: () => null,
                  Ok: ({ queryExecution: qE }) => qE,
                })

                return (
                  <QueriesFetcher
                    workgroup={
                      workgroup ||
                      queryExecution?.workgroup ||
                      workgroups?.defaultWorkgroup ||
                      ''
                    }
                  >
                    {({
                      queriesData,
                      executionsData,
                      handleQueriesLoadMore,
                      handleExecutionsLoadMore,
                    }) => (
                      <QueryRunner
                        queryBody={queryRequest || ''}
                        workgroup={workgroup || workgroups?.defaultWorkgroup || ''}
                      >
                        {({ queryRunData }) =>
                          children({
                            customQueryBody,
                            executionsData,
                            handleExecutionsLoadMore,
                            handleQueriesLoadMore,
                            handleQueryBodyChange: setCustomQueryBody,
                            handleQueryMetaChange,
                            handleQueryResultsLoadMore,
                            handleSubmit,
                            handleWorkgroupChange,
                            handleWorkgroupsLoadMore,
                            queriesData,
                            queryMeta,
                            queryResultsData,
                            queryRunData,
                            workgroupsData,
                            workgroup:
                              workgroup ||
                              queryExecution?.workgroup ||
                              workgroups?.defaultWorkgroup,
                          })
                        }
                      </QueryRunner>
                    )}
                  </QueriesFetcher>
                )
              }}
            </QueryResultsFetcher>
          ),
        })
      }
    </WorkgroupsFetcher>
  )
}

const isButtonDisabled = (
  queryContent: string,
  queryRunData: requests.AsyncData<requests.athena.QueryRunResponse>,
  error: Error | null,
): boolean => !!error || !queryContent || !!queryRunData.case({ Pending: R.T, _: R.F })

interface AthenaProps
  extends RouteComponentProps<{ bucket: string; queryExecutionId?: string }> {}

export default function Athena({
  match: {
    params: { bucket, queryExecutionId },
  },
}: AthenaProps) {
  const classes = useStyles()

  const { urls } = NamedRoutes.use()

  return (
    <QueriesState queryExecutionId={queryExecutionId || null}>
      {({
        customQueryBody,
        executionsData,
        handleExecutionsLoadMore,
        handleQueriesLoadMore,
        handleQueryBodyChange,
        handleQueryMetaChange,
        handleQueryResultsLoadMore,
        handleSubmit,
        handleWorkgroupChange,
        handleWorkgroupsLoadMore,
        queriesData,
        queryMeta,
        queryResultsData,
        queryRunData,
        workgroupsData,
        workgroup,
      }) => (
        <div>
          {queryRunData.case({
            Ok: ({ id }) => <Redirect to={urls.bucketAthenaQueryExecution(bucket, id)} />,
            _: () => null,
          })}

          <M.Typography variant="h6">Athena SQL</M.Typography>

          <div className={classes.selects}>
            <div className={classes.select}>
              {workgroupsData.case({
                Ok: (workgroups) => (
                  <>
                    <M.Typography className={classes.sectionHeader}>
                      Select workgroup
                    </M.Typography>

                    {workgroups.list.length ? (
                      <WorkgroupSelect
                        workgroups={workgroups}
                        onChange={handleWorkgroupChange}
                        onLoadMore={handleWorkgroupsLoadMore}
                        value={workgroup}
                      />
                    ) : (
                      <M.FormHelperText>There are no workgroups.</M.FormHelperText>
                    )}
                  </>
                ),
                Err: makeAsyncDataErrorHandler('Workgroups Data'),
                _: () => <SelectSkeleton />,
              })}
            </div>

            <div className={classes.select}>
              {queriesData.case({
                Ok: (queries) =>
                  queries.list.length ? (
                    <>
                      <M.Typography className={classes.sectionHeader} variant="body1">
                        Select query
                      </M.Typography>

                      <QuerySelect
                        queries={queries.list}
                        onChange={handleQueryMetaChange}
                        value={customQueryBody ? null : queryMeta}
                        onLoadMore={
                          queries.next ? () => handleQueriesLoadMore(queries) : undefined
                        }
                      />
                    </>
                  ) : (
                    <M.Typography className={classes.emptySelect} variant="body1">
                      There are no saved queries.
                    </M.Typography>
                  ),
                Err: makeAsyncDataErrorHandler('Select query'),
                _: () => <SelectSkeleton />,
              })}
            </div>
          </div>

          <div className={classes.form}>
            {queryResultsData.case({
              _: ({
                value: queryResults,
              }: {
                value: requests.athena.QueryResultsResponse
              }) => {
                const areQueriesLoaded = queriesData.case({ Ok: R.T, _: R.F })
                if (!areQueriesLoaded) return <FormSkeleton />
                return (
                  <Form
                    disabled={isButtonDisabled(
                      customQueryBody ||
                        queryResults?.queryExecution?.query ||
                        queryMeta?.body ||
                        '',
                      queryRunData,
                      null,
                    )}
                    onChange={handleQueryBodyChange}
                    onSubmit={handleSubmit}
                    value={
                      customQueryBody ||
                      queryResults?.queryExecution?.query ||
                      queryMeta?.body ||
                      ''
                    }
                  />
                )
              },
              Err: makeAsyncDataErrorHandler('Query Body'),
              Pending: () => <FormSkeleton />,
            })}
          </div>

          <div>
            {queryExecutionId ? (
              <M.Breadcrumbs className={classes.sectionHeader}>
                <Link to={urls.bucketAthenaQueries(bucket)}>Query Executions</Link>
                <M.Typography color="textPrimary">
                  Results for {queryExecutionId}
                </M.Typography>
              </M.Breadcrumbs>
            ) : (
              <M.Typography className={classes.sectionHeader} color="textPrimary">
                Query Executions
              </M.Typography>
            )}

            {!queryExecutionId &&
              executionsData.case({
                Ok: (executions) => (
                  <ExecutionsViewer
                    bucket={bucket}
                    executions={executions.list}
                    onLoadMore={
                      executions.next
                        ? () => handleExecutionsLoadMore(executions)
                        : undefined
                    }
                  />
                ),
                Err: makeAsyncDataErrorHandler('Executions Data'),
                _: () => <ExecutionsSkeleton />,
              })}
          </div>

          {queryResultsData.case({
            Init: () => null,
            Ok: (queryResults: requests.athena.QueryResultsResponse) => (
              <AthenaResults
                results={queryResults.list}
                onLoadMore={
                  queryResults.next
                    ? () => handleQueryResultsLoadMore(queryResults)
                    : undefined
                }
              />
            ),
            Err: makeAsyncDataErrorHandler('Query Results Data'),
            _: () => <AthenaResultsSkeleton />,
          })}
        </div>
      )}
    </QueriesState>
  )
}
