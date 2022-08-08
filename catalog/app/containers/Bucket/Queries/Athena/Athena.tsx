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
  onChange: (q: requests.athena.AthenaQuery | null) => void
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

              <QuerySelect<requests.athena.AthenaQuery | null>
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

interface QueryRunnerState {
  value: string | null
  change: (value: string | null) => void
  data: requests.AsyncData<requests.athena.QueryRunResponse>
  submit: (body: string) => () => void
}

// TODO: split queryBody and queryRunner
function useQueryRunner(
  queryExecutionId: string | null,
  workgroup: string,
): QueryRunnerState {
  // Custom query content, not associated with queryMeta
  const [customQueryBody, setCustomQueryBody] = React.useState<string | null>(null)

  // Query content requested to Athena
  const [queryRequest, setQueryRequest] = React.useState<string | null>(null)

  const submit = React.useMemo(() => (body: string) => () => setQueryRequest(body), [])

  React.useEffect(() => {
    setQueryRequest(null)
  }, [queryExecutionId])

  const data = requests.athena.useQueryRun(workgroup, queryRequest || '')
  const { push: notify } = Notifications.use()
  React.useEffect(() => {
    data.case({
      _: () => null,
      Ok: ({ id }) => {
        if (id === queryExecutionId) notify('Query execution results remain unchanged')
        return null
      },
    })
  }, [notify, queryExecutionId, data])
  return React.useMemo(
    () => ({ data, value: customQueryBody, change: setCustomQueryBody, submit }),
    [customQueryBody, data, submit],
  )
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

interface QueriesState {
  data: requests.AsyncData<requests.athena.QueriesResponse>
  loadMore: (prev: requests.athena.QueriesResponse) => void
  value: requests.athena.AthenaQuery | null
  change: (value: requests.athena.AthenaQuery | null) => void
}

function useQueries(workgroup: string): QueriesState {
  // Info about query: name, url, etc.
  const [queryMeta, setQueryMeta] = React.useState<requests.athena.AthenaQuery | null>(
    null,
  )
  const [prev, setPrev] = React.useState<requests.athena.QueriesResponse | null>(null)
  const data = requests.athena.useQueries(workgroup, prev)
  return React.useMemo(
    () => ({
      loadMore: setPrev,
      data,
      value: queryMeta,
      change: setQueryMeta,
    }),
    [data, queryMeta],
  )
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
  value: requests.athena.Workgroup | null
  change: (w: requests.athena.Workgroup | null) => void
}

function useWorkgroups(): WorkgroupsState {
  const [prev, setPrev] = React.useState<requests.athena.WorkgroupsResponse | null>(null)
  const data = requests.athena.useWorkgroups(prev)
  const [workgroup, setWorkgroup] = React.useState<requests.athena.Workgroup | null>(null)
  return React.useMemo(
    () => ({ data, loadMore: setPrev, value: workgroup, change: setWorkgroup }),
    [data, workgroup],
  )
}

interface PageState {
  workgroups: WorkgroupsState
  queries: QueriesState
  results: QueryResults
  executions: ExecutionsState
  // TODO: queryBody: {value, change, submit} ?
  queryRunner: QueryRunnerState
}

function useState(queryExecutionId: string | null): PageState | null | Error {
  const workgroups = useWorkgroups()
  const results = useQueryResults(queryExecutionId)

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
      _: () => workgroups.value || queryExecution?.workgroup || '',
      Ok: ({ defaultWorkgroup }) =>
        workgroups.value || queryExecution?.workgroup || defaultWorkgroup || '',
    })
  }, [workgroups, results])

  const executions = useExecutions(selectedWorkgroup)
  const queries = useQueries(selectedWorkgroup)

  const handleWorkgroupChange = React.useCallback(
    (w: string | null) => {
      workgroups.change(w)
      queries.change(null)
    },
    [queries, workgroups],
  )

  const queryRunner = useQueryRunner(queryExecutionId, selectedWorkgroup)

  const handleQueryMetaChange = React.useCallback(
    (query: requests.athena.AthenaQuery | null) => {
      queries.change(query)
      queryRunner.change(null)
    },
    [queries, queryRunner],
  )

  // TODO: use hooks instead of nested components
  return React.useMemo(
    () =>
      workgroups.data.case({
        _: (workgroupsDataResult) => {
          if (
            !AsyncResult.Init.is(workgroupsDataResult) &&
            !AsyncResult.Pending.is(workgroupsDataResult) &&
            !workgroupsDataResult.value?.list?.length
          )
            return null

          return {
            workgroups: {
              ...workgroups,
              value: selectedWorkgroup,
              change: handleWorkgroupChange,
            },
            queries: {
              ...queries,
              change: handleQueryMetaChange,
            },
            results,
            executions,
            queryRunner,
          }
        },
        Err: R.identity,
      }),
    [
      executions,
      handleQueryMetaChange,
      handleWorkgroupChange,
      queries,
      queryRunner,
      results,
      selectedWorkgroup,
      workgroups,
    ],
  )
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

  const state = useState(queryExecutionId || null)

  if (state instanceof Error) return <WorkgroupsEmpty error={state} />

  if (!state) return <WorkgroupsEmpty />

  const { workgroups, queries, results, executions, queryRunner } = state

  return queryRunner.data.case({
    _: ({ value: executionData }) => {
      if (executionData?.id && executionData?.id !== queryExecutionId) {
        return (
          <Redirect to={urls.bucketAthenaQueryExecution(bucket, executionData?.id)} />
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
              value={workgroups.value}
            />

            <QueryMetaField
              className={classes.select}
              queriesData={queries.data}
              onChange={queries.change}
              onLoadMore={queries.loadMore}
              value={queryRunner.value ? null : queries.value}
            />
          </div>

          <QueryBodyField
            className={classes.form}
            customQueryBody={queryRunner.value}
            queriesData={queries.data}
            queryMeta={queries.value}
            queryResultsData={results.data}
            queryRunData={queryRunner.data}
            onChange={queryRunner.change}
            onSubmit={queryRunner.submit}
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
