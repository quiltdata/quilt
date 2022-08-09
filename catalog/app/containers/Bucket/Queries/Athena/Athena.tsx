import * as R from 'ramda'
import * as React from 'react'
import { RouteComponentProps } from 'react-router'
import { Link, useHistory } from 'react-router-dom'
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
import Workgroups from './Workgroups'

function safeAdd(a?: string, b?: string): string | undefined {
  if (!a) return b
  if (!b) return a
  return a + b
}

const useAthenaQueriesStyles = M.makeStyles((t) => ({
  form: {
    margin: t.spacing(1, 0, 0),
  },
}))

interface QueryMetaFieldProps {
  bucket: string
  className?: string
  queryExecutionId?: string
  results: QueryResults
  workgroup: requests.athena.Workgroup
}

function AthenaQueries({
  bucket,
  queryExecutionId,
  className,
  results,
  workgroup,
}: QueryMetaFieldProps) {
  const [query, setQuery] = React.useState<requests.athena.AthenaQuery | null>(null)
  const [prev, setPrev] = React.useState<requests.athena.QueriesResponse | null>(null)
  const data = requests.athena.useQueries(workgroup, prev)
  const classes = useAthenaQueriesStyles()
  return (
    <div className={className}>
      {data.case({
        Ok: (queries) => (
          <Section title="Select query" empty="There are no saved queries.">
            {queries.list.length && (
              <QuerySelect<requests.athena.AthenaQuery | null>
                onChange={setQuery}
                onLoadMore={queries.next ? () => setPrev(queries) : undefined}
                queries={queries.list}
                value={query}
              />
            )}
          </Section>
        ),
        Err: makeAsyncDataErrorHandler('Select query'),
        _: () => <SelectSkeleton />,
      })}
      {results.data.case({
        _: ({ value: resultsResponse }) => (
          <QueryBodyField
            bucket={bucket}
            workgroup={workgroup}
            queryExecutionId={queryExecutionId}
            initialValue={resultsResponse?.queryExecution?.query || query?.body || null}
            className={classes.form}
            key={safeAdd(query?.key, resultsResponse?.queryExecution?.query)}
          />
        ),
        Pending: () => <FormSkeleton />,
      })}
    </div>
  )
}

function useQueryRun(
  bucket: string,
  workgroup: requests.athena.Workgroup,
  queryExecutionId?: string,
) {
  const { urls } = NamedRoutes.use()
  const history = useHistory()
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<Error | undefined>()
  const runQuery = requests.athena.useQueryRun(workgroup)
  const { push: notify } = Notifications.use()
  const onSubmit = React.useCallback(
    async (value: string) => {
      setLoading(true)
      setError(undefined)
      try {
        const { id } = await runQuery(value)
        if (id === queryExecutionId) notify('Query execution results remain unchanged')
        history.push(urls.bucketAthenaExecution(bucket, workgroup, id))
      } catch (e) {
        if (e instanceof Error) {
          setError(e)
        }
      } finally {
        setLoading(false)
      }
    },
    [bucket, history, notify, runQuery, queryExecutionId, urls, workgroup],
  )
  return React.useMemo(
    () => ({
      loading,
      error,
      onSubmit,
    }),
    [loading, error, onSubmit],
  )
}

const useQueryBodyFieldStyles = M.makeStyles((t) => ({
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

interface QueryBodyProps {
  bucket: string
  className?: string
  initialValue: string | null
  queryExecutionId?: string
  workgroup: requests.athena.Workgroup
}

function QueryBodyField({
  bucket,
  className,
  initialValue,
  workgroup,
  queryExecutionId,
}: QueryBodyProps) {
  const classes = useQueryBodyFieldStyles()
  // Custom query content, not associated with queryMeta
  const [value, setValue] = React.useState<string | null>(initialValue)

  const { loading, error, onSubmit } = useQueryRun(bucket, workgroup, queryExecutionId)
  const handleSubmit = React.useCallback(() => {
    if (!value) return
    onSubmit(value)
  }, [onSubmit, value])

  return (
    <div className={className}>
      <QueryEditor className={classes.viewer} onChange={setValue} query={value || ''} />

      {error && (
        <Lab.Alert className={classes.error} severity="error">
          {error.message}
        </Lab.Alert>
      )}

      <div className={classes.actions}>
        <M.Button
          variant="contained"
          color="primary"
          disabled={!value || loading}
          onClick={handleSubmit}
        >
          Run query
        </M.Button>
      </div>
    </div>
  )
}

interface HistoryContainerProps {
  bucket: string
  className: string
  workgroup: requests.athena.Workgroup
}

function HistoryContainer({ bucket, className, workgroup }: HistoryContainerProps) {
  const [prev, setPrev] = React.useState<requests.athena.QueryExecutionsResponse | null>(
    null,
  )
  const data = requests.athena.useQueryExecutions(workgroup, prev)
  return (
    <Section title="Query executions" className={className}>
      {data.case({
        Ok: (executions) => (
          <History
            bucket={bucket}
            executions={executions.list}
            onLoadMore={executions.next ? () => setPrev(executions) : undefined}
            workgroup={workgroup}
          />
        ),
        Err: makeAsyncDataErrorHandler('Executions Data'),
        _: () => <TableSkeleton size={4} />,
      })}
    </Section>
  )
}

const useResultsContainerStyles = M.makeStyles((t) => ({
  breadcrumbs: {
    margin: t.spacing(0, 0, 1),
  },
}))

interface ResultsContainerProps {
  bucket: string
  className: string
  queryExecutionId: string
  results: QueryResults
  workgroup: requests.athena.Workgroup
}

function ResultsContainer({
  bucket,
  className,
  queryExecutionId,
  results,
  workgroup,
}: ResultsContainerProps) {
  const classes = useResultsContainerStyles()
  return (
    <div className={className}>
      <ResultsBreadcrumbs
        bucket={bucket}
        className={classes.breadcrumbs}
        queryExecutionId={queryExecutionId}
        workgroup={workgroup}
      />
      {results.data.case({
        Init: () => null,
        Ok: (queryResults) => {
          if (queryResults.rows.length) {
            return (
              <Results
                rows={queryResults.rows}
                columns={queryResults.columns}
                onLoadMore={
                  queryResults.next ? () => results.loadMore(queryResults) : undefined
                }
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
      })}
    </div>
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

interface QueryResults {
  data: requests.AsyncData<requests.athena.QueryResultsResponse>
  loadMore: (prev: requests.athena.QueryResultsResponse) => void
}

function useQueryResults(queryExecutionId?: string): QueryResults {
  const [prev, usePrev] = React.useState<requests.athena.QueryResultsResponse | null>(
    null,
  )
  const data = requests.athena.useQueryResults(queryExecutionId || null, prev)
  return React.useMemo(() => ({ data, loadMore: usePrev }), [data])
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
  bucket: string
  className?: string
  queryExecutionId?: string
  workgroup: requests.athena.Workgroup
}

function ResultsBreadcrumbs({
  bucket,
  className,
  queryExecutionId,
  workgroup,
}: HistoryHeaderProps) {
  const classes = useHistoryHeaderStyles()
  const overrideClasses = useOverrideStyles()
  const { urls } = NamedRoutes.use()
  return (
    <M.Breadcrumbs className={className} classes={overrideClasses}>
      <Link
        className={classes.breadcrumb}
        to={urls.bucketAthenaWorkgroup(bucket, workgroup)}
      >
        Query Executions
      </Link>
      <M.Typography className={classes.breadcrumb} color="textPrimary">
        Results for <Code>{queryExecutionId}</Code>
      </M.Typography>
    </M.Breadcrumbs>
  )
}

const useAthenaStyles = M.makeStyles((t) => ({
  history: {
    margin: t.spacing(4, 0, 0),
  },
  queries: {
    margin: t.spacing(3, 0, 0),
  },
  results: {
    margin: t.spacing(4, 0, 0),
  },
}))

interface AthenaProps {
  className: string
  bucket: string
  queryExecutionId?: string
  workgroup: requests.athena.Workgroup
}

function Athena({ className, bucket, queryExecutionId, workgroup }: AthenaProps) {
  const classes = useAthenaStyles()

  const results = useQueryResults(queryExecutionId)

  return (
    <div className={className}>
      <AthenaQueries
        bucket={bucket}
        className={classes.queries}
        key={workgroup}
        queryExecutionId={queryExecutionId}
        results={results}
        workgroup={workgroup}
      />

      {queryExecutionId ? (
        <ResultsContainer
          bucket={bucket}
          className={classes.results}
          results={results}
          workgroup={workgroup}
          queryExecutionId={queryExecutionId}
        />
      ) : (
        <HistoryContainer
          bucket={bucket}
          className={classes.history}
          workgroup={workgroup}
        />
      )}
    </div>
  )
}

const useStyles = M.makeStyles((t) => ({
  header: {
    margin: t.spacing(0, 0, 1),
  },
  content: {
    margin: t.spacing(1, 0, 0),
  },

  // form: {
  //   margin: t.spacing(0, 0, 4),
  // },
  // results: {
  //   margin: t.spacing(4, 0, 0),
  // },
  // sectionHeader: {
  //   margin: t.spacing(0, 0, 1),
  // },
  // queries: {
  //   margin: t.spacing(3, 0, 0),
  // },
}))

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
  const classes = useStyles()
  return (
    <>
      <M.Typography className={classes.header} variant="h6">
        Athena SQL
      </M.Typography>

      <Workgroups bucket={bucket} workgroup={workgroup || null} />

      {workgroup && (
        <Athena
          className={classes.content}
          bucket={bucket}
          queryExecutionId={queryExecutionId}
          workgroup={workgroup}
        />
      )}
    </>
  )
}
