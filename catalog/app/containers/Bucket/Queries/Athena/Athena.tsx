import * as R from 'ramda'
import * as React from 'react'
import { RouteComponentProps } from 'react-router'
import { Link, Redirect } from 'react-router-dom'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import Code from 'components/Code'
import Skeleton from 'components/Skeleton'
import * as Notifications from 'containers/Notifications'
// import * as urls from 'constants/urls' // TODO: uncomment on docs deploy
import AsyncResult from 'utils/AsyncResult'
import * as NamedRoutes from 'utils/NamedRoutes'
import * as Sentry from 'utils/Sentry'
// import StyledLink from 'utils/StyledLink' // TODO: uncomment on docs deploy

import QuerySelect from '../QuerySelect'
import * as requests from '../requests'

import QueryEditor from './QueryEditor'
import Results from './Results'
import History from './History'
import WorkgroupSelect from './WorkgroupSelect'

interface WorkgroupFieldProps {
  className?: string
  workgroupsData: requests.AsyncData<requests.athena.WorkgroupsResponse>
  onChange: (w: requests.athena.Workgroup | null) => void
  onLoadMore: (prev: requests.athena.WorkgroupsResponse) => void
  value: requests.athena.Workgroup | null
}
function WorkgroupField({
  className,
  workgroupsData,
  onChange,
  onLoadMore,
  value,
}: WorkgroupFieldProps) {
  const classes = useStyles()
  return (
    <div className={className}>
      {workgroupsData.case({
        Ok: (workgroups) => (
          <>
            <M.Typography className={classes.sectionHeader}>
              Select workgroup
            </M.Typography>

            {workgroups.list.length ? (
              <WorkgroupSelect
                onChange={onChange}
                onLoadMore={onLoadMore}
                value={value}
                workgroups={workgroups}
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
  )
}

interface QueryMetaFieldProps {
  className?: string
  onChange: (q: requests.Query | requests.athena.AthenaQuery | null) => void
  onLoadMore: (prev: requests.athena.QueriesResponse) => void
  queriesData: requests.AsyncData<requests.athena.QueriesResponse>
  value: requests.athena.AthenaQuery | null
}

function QueryMetaField({
  className,
  onChange,
  onLoadMore,
  queriesData,
  value,
}: QueryMetaFieldProps) {
  const classes = useStyles()
  return (
    <div className={className}>
      {queriesData.case({
        Ok: (queries) =>
          queries.list.length ? (
            <>
              <M.Typography className={classes.sectionHeader} variant="body1">
                Select query
              </M.Typography>

              <QuerySelect
                onChange={onChange}
                onLoadMore={queries.next ? () => onLoadMore(queries) : undefined}
                queries={queries.list}
                value={value}
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
  )
}

interface QueryBodyProps {
  className?: string
  customQueryBody: string | null
  onChange: (q: string | null) => void
  onSubmit: (q: string) => () => void
  queriesData: requests.AsyncData<requests.athena.QueriesResponse>
  queryMeta: requests.athena.AthenaQuery | null
  queryResultsData: requests.AsyncData<requests.athena.QueryResultsResponse>
  queryRunData: requests.AsyncData<requests.athena.QueryRunResponse>
}

function QueryBodyField({
  className,
  customQueryBody,
  onChange,
  onSubmit,
  queriesData,
  queryMeta,
  queryResultsData,
  queryRunData,
}: QueryBodyProps) {
  return (
    <div className={className}>
      {queryResultsData.case({
        _: ({ value: queryResults }) => {
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
              onChange={onChange}
              onSubmit={onSubmit}
              error={(queryRunData as $TSFixMe).case({
                Err: R.identity,
                _: () => undefined,
              })}
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
  )
}

interface HistoryContainerProps {
  bucket: string
  executionsData: requests.AsyncData<requests.athena.QueryExecutionsResponse>
  onLoadMore: (prev: requests.athena.QueryExecutionsResponse) => void
  queryExecutionId?: string
}

function HistoryContainer({
  bucket,
  executionsData,
  queryExecutionId,
  onLoadMore,
}: HistoryContainerProps) {
  const classes = useStyles()
  return (
    <div>
      <HistoryHeader
        bucket={bucket}
        className={classes.sectionHeader}
        queryExecutionId={queryExecutionId}
      />

      {!queryExecutionId &&
        executionsData.case({
          Ok: (executions) => (
            <History
              bucket={bucket}
              executions={executions.list}
              onLoadMore={executions.next ? () => onLoadMore(executions) : undefined}
            />
          ),
          Err: makeAsyncDataErrorHandler('Executions Data'),
          _: () => <TableSkeleton size={4} />,
        })}
    </div>
  )
}

interface ResultsContainerProps {
  bucket: string
  className: string
  onLoadMore: (prev: requests.athena.QueryResultsResponse) => void
  queryResultsData: requests.AsyncData<requests.athena.QueryResultsResponse>
}

function ResultsContainer({
  bucket,
  className,
  onLoadMore,
  queryResultsData,
}: ResultsContainerProps) {
  return queryResultsData.case({
    Init: () => null,
    Ok: (queryResults) => {
      if (queryResults.rows.length) {
        return (
          <Results
            className={className}
            rows={queryResults.rows}
            columns={queryResults.columns}
            onLoadMore={queryResults.next ? () => onLoadMore(queryResults) : undefined}
          />
        )
      }
      if (queryResults.queryExecution) {
        return <History bucket={bucket} executions={[queryResults.queryExecution!]} />
      }
      return makeAsyncDataErrorHandler('Query Results Data')(
        new Error("Couldn't fetch query results"),
      )
    },
    Err: makeAsyncDataErrorHandler('Query Results Data'),
    _: () => <TableSkeleton size={10} />,
  })
}

interface WorkgroupsEmptyProps {
  error?: Error
}

function WorkgroupsEmpty({ error }: WorkgroupsEmptyProps) {
  return (
    <>
      {error ? (
        <Alert title={error.name} error={error} />
      ) : (
        <Lab.Alert severity="info">
          <Lab.AlertTitle>No workgroups configured</Lab.AlertTitle>
        </Lab.Alert>
      )}

      {/* <M.Typography> // TODO: uncomment on docs deploy
        Check{' '}
        <StyledLink href={`${urls.docs}/catalog/queries#athena`}>
          Athena Queries docs
        </StyledLink>{' '}
        on correct usage
      </M.Typography> */}
    </>
  )
}

function SelectSkeleton() {
  return (
    <>
      <Skeleton height={24} width={128} animate />
      <Skeleton height={48} mt={1} animate />
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

interface TableSkeletonProps {
  size: number
}

function TableSkeleton({ size }: TableSkeletonProps) {
  return (
    <>
      <Skeleton height={36} animate />
      {R.range(0, size).map((key) => (
        <Skeleton key={key} height={36} mt={1} animate />
      ))}
    </>
  )
}

interface AlertProps {
  error: Error
  title: string
}

function Alert({ error, title }: AlertProps) {
  const sentry = Sentry.use()

  React.useEffect(() => {
    sentry('captureException', error)
  }, [error, sentry])

  return (
    <Lab.Alert severity="error">
      <Lab.AlertTitle>{title}</Lab.AlertTitle>
      {error.message}
    </Lab.Alert>
  )
}

function makeAsyncDataErrorHandler(title: string) {
  return (error: Error) => <Alert error={error} title={title} />
}

const useStyles = M.makeStyles((t) => ({
  emptySelect: {
    margin: t.spacing(5.5, 0, 0),
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
      marginBottom: t.spacing(-3), // counterpart for Select's optional description
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
  error: {
    margin: t.spacing(1, 0, 0),
  },
  viewer: {
    margin: t.spacing(3, 0, 0),
  },
}))

interface FormProps {
  disabled: boolean
  error?: Error
  onChange: (value: string) => void
  onSubmit: (value: string) => () => void
  value: string | null
}

function Form({ disabled, error, value, onChange, onSubmit }: FormProps) {
  const classes = useFormStyles()

  const handleSubmit = React.useMemo(() => onSubmit(value || ''), [onSubmit, value])

  return (
    <div>
      <QueryEditor className={classes.viewer} onChange={onChange} query={value || ''} />

      {error && (
        <Lab.Alert className={classes.error} severity="error">
          {error.message}
        </Lab.Alert>
      )}

      <div className={classes.actions}>
        <M.Button
          variant="contained"
          color="primary"
          disabled={disabled}
          onClick={handleSubmit}
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
  queryExecutionId: string | null
  workgroup: string
}

function QueryRunner({
  children,
  queryBody,
  queryExecutionId,
  workgroup,
}: QueryRunnerProps) {
  const queryRunData = requests.athena.useQueryRun(workgroup, queryBody)
  const { push: notify } = Notifications.use()
  React.useEffect(() => {
    queryRunData.case({
      _: () => null,
      Ok: ({ id }) => {
        if (id === queryExecutionId) notify('Query execution results remain unchanged')
        return null
      },
    })
  }, [notify, queryExecutionId, queryRunData])
  return children({ queryRunData })
}

interface QueryResults {
  data: requests.AsyncData<requests.athena.QueryResultsResponse>
  loadMore: (prev: requests.athena.QueryResultsResponse) => void
}

function useQueryResults(queryExecutionId: string | null): QueryResults {
  const [prev, usePrev] = React.useState<requests.athena.QueryResultsResponse | null>(
    null,
  )
  const data = requests.athena.useQueryResults(queryExecutionId, prev)
  return React.useMemo(() => ({ data, loadMore: usePrev }), [data])
}

interface QueriesFetcherRenderProps {
  handleQueriesLoadMore: (prev: requests.athena.QueriesResponse) => void
  queriesData: requests.AsyncData<requests.athena.QueriesResponse>
}

interface QueriesFetcherProps {
  children: (props: QueriesFetcherRenderProps) => React.ReactElement
  workgroup: string
}

function QueriesFetcher({ children, workgroup }: QueriesFetcherProps) {
  const [prevQueries, setPrevQueries] =
    React.useState<requests.athena.QueriesResponse | null>(null)
  const queriesData = requests.athena.useQueries(workgroup, prevQueries)
  return children({
    handleQueriesLoadMore: setPrevQueries,
    queriesData,
  })
}

interface ExecutionsState {
  data: requests.AsyncData<requests.athena.QueryExecutionsResponse>
  loadMore: (prev: requests.athena.QueryExecutionsResponse) => void
}

function useExecutions(workgroup: string): ExecutionsState {
  const [prev, setPrev] = React.useState<requests.athena.QueryExecutionsResponse | null>(
    null,
  )
  const data = requests.athena.useQueryExecutions(workgroup, prev)
  return React.useMemo(
    () => ({
      data,
      loadMore: setPrev,
    }),
    [data],
  )
}

interface WorkgroupsState {
  data: requests.AsyncData<requests.athena.WorkgroupsResponse>
  loadMore: (prev: requests.athena.WorkgroupsResponse) => void
  selected: requests.athena.Workgroup | null
  change: (w: requests.athena.Workgroup | null) => void
}

function useWorkgroups(): WorkgroupsState {
  const [prev, setPrev] = React.useState<requests.athena.WorkgroupsResponse | null>(null)
  const data = requests.athena.useWorkgroups(prev)
  const [workgroup, setWorkgroup] = React.useState<requests.athena.Workgroup | null>(null)
  return React.useMemo(
    () => ({ data, loadMore: setPrev, selected: workgroup, change: setWorkgroup }),
    [data, workgroup],
  )
}

interface StateRenderProps {
  workgroups: WorkgroupsState
  queries: {
    data: requests.AsyncData<requests.athena.QueriesResponse>
    loadMore: (prev: requests.athena.QueriesResponse) => void
    selected: requests.athena.AthenaQuery | null
    change: (q: requests.Query | requests.athena.AthenaQuery | null) => void
  }
  results: QueryResults
  executions: ExecutionsState
  // TODO: queryBody: {value, change, submit} ?
  customQueryBody: string | null
  handleQueryBodyChange: (q: string | null) => void
  handleSubmit: (q: string) => () => void
  queryRunData: requests.AsyncData<requests.athena.QueryRunResponse>
}

interface StateProps {
  children: (props: StateRenderProps) => React.ReactElement
  queryExecutionId: string | null
}

function State({ children, queryExecutionId }: StateProps) {
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

  // Query content requested to Athena
  const [queryRequest, setQueryRequest] = React.useState<string | null>(null)

  const handleSubmit = React.useMemo(
    () => (body: string) => () => setQueryRequest(body),
    [setQueryRequest],
  )

  React.useEffect(() => {
    setQueryRequest(null)
  }, [queryExecutionId])

  const workgroups = useWorkgroups()
  const results = useQueryResults(queryExecutionId)

  const handleWorkgroupChange = React.useCallback(
    (w: string | null) => {
      workgroups.change(w)
      setQueryMeta(null)
    },
    [setQueryMeta, workgroups],
  )

  const selectedWorkgroup: string = React.useMemo(() => {
    const queryExecution = (
      results.data as requests.AsyncData<
        requests.athena.QueryResultsResponse,
        requests.athena.QueryExecution | null
      >
    ).case({
      _: () => null,
      Ok: ({ queryExecution: qE }) => qE,
    })
    return (
      workgroups.data as requests.AsyncData<requests.athena.WorkgroupsResponse, $TSFixMe>
    ).case({
      _: () => workgroups.selected || queryExecution?.workgroup || '',
      Ok: ({ defaultWorkgroup }) =>
        workgroups.selected || queryExecution?.workgroup || defaultWorkgroup || '',
    })
  }, [workgroups, results])

  const executions = useExecutions(selectedWorkgroup)

  // TODO: use hooks instead of nested components
  return workgroups.data.case({
    _: (workgroupsDataResult) => {
      if (
        !AsyncResult.Init.is(workgroupsDataResult) &&
        !AsyncResult.Pending.is(workgroupsDataResult) &&
        !workgroupsDataResult.value?.list?.length
      )
        return <WorkgroupsEmpty />

      return (
        <QueriesFetcher workgroup={selectedWorkgroup} key={queryExecutionId}>
          {({ queriesData, handleQueriesLoadMore }) => (
            <QueryRunner
              queryBody={queryRequest || ''}
              queryExecutionId={queryExecutionId}
              workgroup={selectedWorkgroup}
            >
              {({ queryRunData }) =>
                children({
                  workgroups: {
                    ...workgroups,
                    selected: selectedWorkgroup,
                    change: handleWorkgroupChange,
                  },
                  queries: {
                    data: queriesData,
                    loadMore: handleQueriesLoadMore,
                    selected: queryMeta,
                    change: handleQueryMetaChange,
                  },
                  results,
                  executions,
                  customQueryBody,
                  handleQueryBodyChange: setCustomQueryBody,
                  handleSubmit,
                  queryRunData,
                })
              }
            </QueryRunner>
          )}
        </QueriesFetcher>
      )
    },
    Err: (error) => <WorkgroupsEmpty error={error} />,
  })
}

const useOverrideStyles = M.makeStyles({
  li: {
    '&::before': {
      position: 'absolute', // Workaround for sanitize.css a11y styles
    },
  },
  separator: {
    alignItems: 'center',
  },
})

const useHistoryHeaderStyles = M.makeStyles({
  breadcrumb: {
    display: 'flex',
  },
})

interface HistoryHeaderProps {
  queryExecutionId?: string | null
  bucket: string
  className: string
}

function HistoryHeader({ bucket, className, queryExecutionId }: HistoryHeaderProps) {
  const classes = useHistoryHeaderStyles()
  const overrideClasses = useOverrideStyles()
  const { urls } = NamedRoutes.use()
  const rootTitle = 'Query Executions'
  if (!queryExecutionId) {
    return (
      <M.Typography className={className} color="textPrimary">
        {rootTitle}
      </M.Typography>
    )
  }

  return (
    <M.Breadcrumbs className={className} classes={overrideClasses}>
      <Link className={classes.breadcrumb} to={urls.bucketAthenaQueries(bucket)}>
        {rootTitle}
      </Link>
      <M.Typography className={classes.breadcrumb} color="textPrimary">
        Results for <Code>{queryExecutionId}</Code>
      </M.Typography>
    </M.Breadcrumbs>
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
    <State queryExecutionId={queryExecutionId || null}>
      {({
        customQueryBody,
        handleQueryBodyChange,
        handleSubmit,
        queryRunData,
        workgroups,
        queries,
        results,
        executions,
      }) =>
        queryRunData.case({
          _: ({ value: executionData }) => {
            if (executionData?.id && executionData?.id !== queryExecutionId) {
              return (
                <Redirect
                  to={urls.bucketAthenaQueryExecution(bucket, executionData?.id)}
                />
              )
            }

            return (
              <>
                <M.Typography variant="h6">Athena SQL</M.Typography>

                <div className={classes.selects}>
                  <WorkgroupField
                    className={classes.select}
                    workgroupsData={workgroups.data}
                    onChange={workgroups.change}
                    onLoadMore={workgroups.loadMore}
                    value={workgroups.selected}
                  />

                  <QueryMetaField
                    className={classes.select}
                    queriesData={queries.data}
                    onChange={queries.change}
                    onLoadMore={queries.loadMore}
                    value={customQueryBody ? null : queries.selected}
                  />
                </div>

                <QueryBodyField
                  className={classes.form}
                  customQueryBody={customQueryBody}
                  queriesData={queries.data}
                  queryMeta={queries.selected}
                  queryResultsData={results.data}
                  queryRunData={queryRunData}
                  onChange={handleQueryBodyChange}
                  onSubmit={handleSubmit}
                />

                <HistoryContainer
                  bucket={bucket}
                  executionsData={executions.data}
                  queryExecutionId={queryExecutionId}
                  onLoadMore={executions.loadMore}
                />

                <ResultsContainer
                  bucket={bucket}
                  className={classes.results}
                  onLoadMore={results.loadMore}
                  queryResultsData={results.data}
                />
              </>
            )
          },
        })
      }
    </State>
  )
}
