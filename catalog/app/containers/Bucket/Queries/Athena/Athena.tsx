import cx from 'classnames'
import * as R from 'ramda'
import * as React from 'react'
import type { RouteComponentProps } from 'react-router'
import * as RRDom from 'react-router-dom'
import * as M from '@material-ui/core'

import Code from 'components/Code'
import Skeleton from 'components/Skeleton'
import * as NamedRoutes from 'utils/NamedRoutes'

import QuerySelect from '../QuerySelect'
import * as requests from '../requests'

import { Section, makeAsyncDataErrorHandler } from './Components'
import CreatePackage from './CreatePackage'
import * as QueryEditor from './QueryEditor'
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
    margin: t.spacing(3, 0, 0),
  },
}))

interface QueryConstructorProps {
  bucket: string
  className?: string
  queryExecutionId?: string
  results: QueryResults
  workgroup: requests.athena.Workgroup
}

function QueryConstructor({
  bucket,
  queryExecutionId,
  className,
  results,
  workgroup,
}: QueryConstructorProps) {
  const [query, setQuery] = React.useState<requests.athena.AthenaQuery | null>(null)
  const [prev, setPrev] = React.useState<requests.athena.QueriesResponse | null>(null)
  const data = requests.athena.useQueries(workgroup, prev)
  const classes = useAthenaQueriesStyles()
  return (
    <div className={className}>
      {data.case({
        Ok: (queries) => (
          <Section title="Select query" empty="There are no saved queries.">
            {!!queries.list.length && (
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
        _: () => (
          <>
            <Skeleton height={24} width={128} animate />
            <Skeleton height={48} mt={1} animate />
          </>
        ),
      })}
      {results.data.case({
        _: ({ value: resultsResponse }) => (
          <QueryEditor.Form
            bucket={bucket}
            className={classes.form}
            initialValue={resultsResponse?.queryExecution?.query || query?.body || null}
            queryExecutionId={queryExecutionId}
            workgroup={workgroup}
            key={safeAdd(query?.key, resultsResponse?.queryExecution?.query)}
          />
        ),
        Pending: () => <QueryEditor.Skeleton className={classes.form} />,
      })}
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
      >
        {results.data.case({
          _: () => null,
          Pending: () => <Skeleton height={24} width={144} animate />,
          Ok: (queryResults) =>
            !!queryResults.rows.length && (
              <CreatePackage bucket={bucket} rows={queryResults.rows} />
            ),
        })}
      </ResultsBreadcrumbs>
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
          if (queryResults.queryExecution.error) {
            return makeAsyncDataErrorHandler('Query Results Data')(
              queryResults.queryExecution.error,
            )
          }
          if (queryResults.queryExecution) {
            return (
              <History
                bucket={bucket}
                executions={[queryResults.queryExecution]}
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
  const [prev, setPrev] = React.useState<requests.athena.QueryResultsResponse | null>(
    null,
  )
  const data = requests.athena.useQueryResults(queryExecutionId || null, prev)
  return React.useMemo(() => ({ data, loadMore: setPrev }), [data])
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

const useResultsBreadcrumbsStyles = M.makeStyles({
  root: {
    alignItems: 'center',
    display: 'flex',
  },
  actions: {
    marginLeft: 'auto',
  },
  breadcrumb: {
    display: 'flex',
  },
  id: {
    marginLeft: '6px',
  },
})

interface ResultsBreadcrumbsProps {
  bucket: string
  children: React.ReactNode
  className?: string
  queryExecutionId?: string
  workgroup: requests.athena.Workgroup
}

function ResultsBreadcrumbs({
  bucket,
  children,
  className,
  queryExecutionId,
  workgroup,
}: ResultsBreadcrumbsProps) {
  const classes = useResultsBreadcrumbsStyles()
  const overrideClasses = useOverrideStyles()
  const { urls } = NamedRoutes.use()
  return (
    <div className={cx(classes.root, className)}>
      <M.Breadcrumbs classes={overrideClasses}>
        <RRDom.Link
          className={classes.breadcrumb}
          to={urls.bucketAthenaWorkgroup(bucket, workgroup)}
        >
          Query Executions
        </RRDom.Link>
        <M.Typography className={classes.breadcrumb} color="textPrimary">
          Results for<Code className={classes.id}>{queryExecutionId}</Code>
        </M.Typography>
      </M.Breadcrumbs>

      <div className={classes.actions}>{children}</div>
    </div>
  )
}

const useStyles = M.makeStyles((t) => ({
  header: {
    margin: t.spacing(0, 0, 2),
  },
  content: {
    margin: t.spacing(1, 0, 0),
  },
  section: {
    margin: t.spacing(3, 0, 0),
  },
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
  const results = useQueryResults(queryExecutionId)
  return (
    <>
      <M.Typography className={classes.header} variant="h6">
        Athena SQL
      </M.Typography>

      <Workgroups bucket={bucket} workgroup={workgroup || null} />

      {workgroup && (
        <div className={classes.content}>
          <QueryConstructor
            bucket={bucket}
            className={classes.section}
            key={workgroup}
            queryExecutionId={queryExecutionId}
            results={results}
            workgroup={workgroup}
          />

          {queryExecutionId ? (
            <ResultsContainer
              bucket={bucket}
              className={classes.section}
              queryExecutionId={queryExecutionId}
              results={results}
              workgroup={workgroup}
            />
          ) : (
            <HistoryContainer
              bucket={bucket}
              className={classes.section}
              workgroup={workgroup}
            />
          )}
        </div>
      )}
    </>
  )
}
