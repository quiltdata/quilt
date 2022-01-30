import * as R from 'ramda'
import * as React from 'react'
import { RouteComponentProps } from 'react-router'
import { Link, Redirect } from 'react-router-dom'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import Code from 'components/Code'
import Skeleton from 'components/Skeleton'
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
  const [prevQueries, setPrevQueries] =
    React.useState<requests.athena.QueriesResponse | null>(null)
  const [prevExecutions, setPrevExecutions] =
    React.useState<requests.athena.QueryExecutionsResponse | null>(null)
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

// TODO:
//   refactor data using these principles:
//   there is list of items (workgroups, queries, executions, results), user can loadMore items of this list
//   also some lists has selected one item (workgroup, queries), user can change selected item
//   Something like this:
//     {
//       [T namespace]: {
//         list: T[]
//         selected?: T,
//         change: (value: T) => void
//         loadMore: (prev: T[]) => void
//       }
//     }

interface StateRenderProps {
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

  const [workgroup, setWorkgroup] = React.useState<requests.athena.Workgroup | null>(null)
  const handleWorkgroupChange = React.useCallback(
    (w) => {
      setWorkgroup(w)
      setQueryMeta(null)
    },
    [setQueryMeta, setWorkgroup],
  )
  return (
    <WorkgroupsFetcher>
      {({ handleWorkgroupsLoadMore, workgroupsData }) =>
        workgroupsData.case({
          _: (workgroupsDataResult) =>
            AsyncResult.Init.is(workgroupsDataResult) ||
            AsyncResult.Pending.is(workgroupsDataResult) ||
            workgroupsDataResult.value?.list?.length ? (
              <QueryResultsFetcher queryExecutionId={queryExecutionId}>
                {({ queryResultsData, handleQueryResultsLoadMore }) => {
                  const queryExecution = (
                    queryResultsData as requests.AsyncData<
                      requests.athena.QueryResultsResponse,
                      requests.athena.QueryExecution | null
                    >
                  ).case({
                    _: () => null,
                    Ok: ({ queryExecution: qE }) => qE,
                  })
                  const selectedWorkgroup =
                    workgroup ||
                    queryExecution?.workgroup ||
                    workgroupsDataResult.value?.defaultWorkgroup ||
                    ''

                  return (
                    <QueriesFetcher workgroup={selectedWorkgroup} key={queryExecutionId}>
                      {({
                        queriesData,
                        executionsData,
                        handleQueriesLoadMore,
                        handleExecutionsLoadMore,
                      }) => (
                        <QueryRunner
                          queryBody={queryRequest || ''}
                          workgroup={selectedWorkgroup}
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
                              workgroup: selectedWorkgroup,
                            })
                          }
                        </QueryRunner>
                      )}
                    </QueriesFetcher>
                  )
                }}
              </QueryResultsFetcher>
            ) : (
              <WorkgroupsEmpty />
            ),
          Err: (error) => <WorkgroupsEmpty error={error} />,
        })
      }
    </WorkgroupsFetcher>
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
  queryExecutionId?: string
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
      }) =>
        queryRunData.case({
          Ok: ({ id }) => <Redirect to={urls.bucketAthenaQueryExecution(bucket, id)} />,
          _: () => (
            <>
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
                              queries.next
                                ? () => handleQueriesLoadMore(queries)
                                : undefined
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
                        onLoadMore={
                          executions.next
                            ? () => handleExecutionsLoadMore(executions)
                            : undefined
                        }
                      />
                    ),
                    Err: makeAsyncDataErrorHandler('Executions Data'),
                    _: () => <TableSkeleton size={4} />,
                  })}
              </div>

              {queryResultsData.case({
                Init: () => null,
                Ok: (queryResults: requests.athena.QueryResultsResponse) => {
                  if (queryResults.list.length) {
                    return (
                      <Results
                        results={queryResults.list}
                        onLoadMore={
                          queryResults.next
                            ? () => handleQueryResultsLoadMore(queryResults)
                            : undefined
                        }
                      />
                    )
                  }
                  if (queryResults.queryExecution) {
                    return (
                      <History
                        bucket={bucket}
                        executions={[queryResults.queryExecution!]}
                      />
                    )
                  }
                  return makeAsyncDataErrorHandler('Query Results Data')(
                    new Error("Couldn't fetch query results"),
                  )
                },
                Err: makeAsyncDataErrorHandler('Query Results Data'),
                _: () => <TableSkeleton size={10} />,
              })}
            </>
          ),
        })
      }
    </State>
  )
}
