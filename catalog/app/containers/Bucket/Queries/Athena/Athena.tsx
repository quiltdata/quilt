import * as R from 'ramda'
import * as React from 'react'
import { RouteComponentProps } from 'react-router'
import { Link, Redirect } from 'react-router-dom'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import Code from 'components/Code'
import Skeleton from 'components/Skeleton'
import * as Notifications from 'containers/Notifications'
import * as NamedRoutes from 'utils/NamedRoutes'

import QuerySelect from '../QuerySelect'
import * as requests from '../requests'

import { Section, makeAsyncDataErrorHandler } from './Components'
import QueryEditor from './QueryEditor'
import Results from './Results'
import History from './History'
import AthenaWorkgroups from './Workgroups'

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
  return (
    <div className={className}>
      {queriesData.case({
        Ok: (queries) => (
          <Section title="Select query" empty="There are no saved queries.">
            {queries.list.length && (
              <QuerySelect<requests.athena.AthenaQuery | null>
                onChange={onChange}
                onLoadMore={queries.next ? () => onLoadMore(queries) : undefined}
                queries={queries.list}
                value={value}
              />
            )}
          </Section>
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
  queryMeta: requests.athena.AthenaQuery | null
  queryResultsData: requests.AsyncData<requests.athena.QueryResultsResponse>
  queryRunData: requests.AsyncData<requests.athena.QueryRunResponse>
}

function QueryBodyField({
  className,
  customQueryBody,
  onChange,
  onSubmit,
  queryMeta,
  queryResultsData,
  queryRunData,
}: QueryBodyProps) {
  const userEnteredValue = React.useMemo(
    () => customQueryBody || queryMeta?.body,
    [customQueryBody, queryMeta],
  )
  const value = React.useMemo(
    () =>
      userEnteredValue ||
      queryResultsData.case({
        Ok: (queryResults) => queryResults?.queryExecution?.query,
        _: () => '',
      }) ||
      '',
    [userEnteredValue, queryResultsData],
  )
  const isLoading = React.useMemo(
    () =>
      queryResultsData.case({
        Pending: R.T,
        _: R.F,
      }),
    [queryResultsData],
  )
  const error = React.useMemo(
    () =>
      queryResultsData.case({
        Err: R.identity,
        _: R.F,
      }),
    [queryResultsData],
  )
  if (isLoading) return <FormSkeleton />
  if (error) return makeAsyncDataErrorHandler('Query Body')(error)

  return (
    <div className={className}>
      <Form
        disabled={isButtonDisabled(value, queryRunData, null)}
        onChange={onChange}
        onSubmit={onSubmit}
        error={(queryRunData as $TSFixMe).case({
          Err: R.identity,
          _: () => undefined,
        })}
        value={value}
      />
    </div>
  )
}

interface HistoryContainerProps {
  bucket: string
  executionsData: requests.AsyncData<requests.athena.QueryExecutionsResponse>
  onLoadMore: (prev: requests.athena.QueryExecutionsResponse) => void
  queryExecutionId?: string
  workgroup: requests.athena.Workgroup
}

function HistoryContainer({
  bucket,
  executionsData,
  queryExecutionId,
  onLoadMore,
  workgroup,
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
              workgroup={workgroup}
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
  workgroup: requests.athena.Workgroup
}

function ResultsContainer({
  bucket,
  className,
  onLoadMore,
  queryResultsData,
  workgroup,
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
        return (
          <History
            bucket={bucket}
            executions={[queryResults.queryExecution!]}
            workgroup={workgroup}
          />
        )
      }
      return makeAsyncDataErrorHandler('Query Results Data')(
        new Error("Couldn't fetch query results"),
      )
    },
    Err: makeAsyncDataErrorHandler('Query Results Data'),
    _: () => <TableSkeleton size={10} />,
  })
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

const useStyles = M.makeStyles((t) => ({
  form: {
    margin: t.spacing(0, 0, 4),
  },
  results: {
    margin: t.spacing(4, 0, 0),
  },
  sectionHeader: {
    margin: t.spacing(0, 0, 1),
  },
  queries: {
    margin: t.spacing(3, 0, 0),
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

interface PageState {
  queries: QueriesState
  results: QueryResults
  executions: ExecutionsState
  // TODO: queryBody: {value, change, submit} ?
  queryRunner: QueryRunnerState
}

function useState(workgroup: string, queryExecutionId: string | null): PageState {
  const results = useQueryResults(queryExecutionId)

  const executions = useExecutions(workgroup)
  const queries = useQueries(workgroup)

  const queryRunner = useQueryRunner(queryExecutionId, workgroup)

  const handleQueryMetaChange = React.useCallback(
    (query: requests.athena.AthenaQuery | null) => {
      queries.change(query)
      queryRunner.change(null)
    },
    [queries, queryRunner],
  )

  return React.useMemo(
    () => ({
      queries: {
        ...queries,
        change: handleQueryMetaChange,
      },
      results,
      executions,
      queryRunner,
    }),
    [executions, handleQueryMetaChange, queries, queryRunner, results],
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

interface AthenaProps {
  bucket: string
  queryExecutionId?: string
  workgroup: requests.athena.Workgroup
}

function Athena({ bucket, queryExecutionId, workgroup }: AthenaProps) {
  const classes = useStyles()

  const { urls } = NamedRoutes.use()

  const state = useState(workgroup, queryExecutionId || null)

  const { queries, results, executions, queryRunner } = state

  return queryRunner.data.case({
    _: ({ value: executionData }) => {
      if (executionData?.id && executionData?.id !== queryExecutionId) {
        return (
          <Redirect
            to={urls.bucketAthenaExecution(bucket, workgroup, executionData?.id)}
          />
        )
      }

      return (
        <>
          <QueryMetaField
            className={classes.queries}
            queriesData={queries.data}
            onChange={queries.change}
            onLoadMore={queries.loadMore}
            value={queryRunner.value ? null : queries.value}
          />

          {queries.data.case({
            Ok: () => (
              <QueryBodyField
                className={classes.form}
                customQueryBody={queryRunner.value}
                queryMeta={queries.value}
                queryResultsData={results.data}
                queryRunData={queryRunner.data}
                onChange={queryRunner.change}
                onSubmit={queryRunner.submit}
              />
            ),
            _: () => <FormSkeleton />,
          })}

          <HistoryContainer
            bucket={bucket}
            executionsData={executions.data}
            queryExecutionId={queryExecutionId}
            onLoadMore={executions.loadMore}
            workgroup={workgroup}
          />

          <ResultsContainer
            bucket={bucket}
            className={classes.results}
            onLoadMore={results.loadMore}
            queryResultsData={results.data}
            workgroup={workgroup}
          />
        </>
      )
    },
  })
}

interface AthenaContainerProps
  extends RouteComponentProps<{
    bucket: string
    queryExecutionId?: string
    workgroup?: string
  }> {}

export default function AthenaContainer({
  match: {
    params: { bucket, queryExecutionId, workgroup },
  },
}: AthenaContainerProps) {
  return (
    <>
      <M.Typography variant="h6">Athena SQL</M.Typography>

      <AthenaWorkgroups bucket={bucket} workgroup={workgroup || null} />

      {workgroup && (
        <Athena
          bucket={bucket}
          queryExecutionId={queryExecutionId}
          workgroup={workgroup}
        />
      )}
    </>
  )
}
