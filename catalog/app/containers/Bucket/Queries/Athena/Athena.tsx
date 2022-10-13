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

import { Alert, Section, makeAsyncDataErrorHandler } from './Components'
import CreatePackage from './CreatePackage'
import * as QueryEditor from './QueryEditor'
import Results from './Results'
import History from './History'
import Workgroups from './Workgroups'

const useAthenaQueriesStyles = M.makeStyles((t) => ({
  form: {
    margin: t.spacing(3, 0, 0),
  },
}))

interface QueryConstructorProps {
  bucket: string
  className?: string
  queryExecutionId?: string
  initialValue?: string
  workgroup: requests.athena.Workgroup
}

function QueryConstructor({
  bucket,
  queryExecutionId,
  className,
  initialValue,
  workgroup,
}: QueryConstructorProps) {
  const [query, setQuery] = React.useState<requests.athena.AthenaQuery | null>(null)
  const [prev, setPrev] = React.useState<requests.athena.QueriesResponse | null>(null)
  const data = requests.athena.useQueries(workgroup, prev)
  const classes = useAthenaQueriesStyles()
  const [value, setValue] = React.useState<string | null>(initialValue || null)
  const handleQueryBodyChange = React.useCallback((v: string) => {
    setValue(v)
    setQuery(null)
  }, [])
  const handleNamedQueryChange = React.useCallback(
    (q: requests.athena.AthenaQuery | null) => {
      setQuery(q)
      setValue(q?.body || null)
    },
    [],
  )
  return (
    <div className={className}>
      {data.case({
        Ok: (queries) => (
          <Section title="Select query" empty="There are no saved queries.">
            {!!queries.list.length && (
              <QuerySelect<requests.athena.AthenaQuery | null>
                onChange={handleNamedQueryChange}
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
      <QueryEditor.Form
        bucket={bucket}
        className={classes.form}
        queryExecutionId={queryExecutionId}
        workgroup={workgroup}
        onChange={handleQueryBodyChange}
        value={value}
      />
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

interface ResultsContainerSkeletonProps {
  bucket: string
  className: string
  queryExecutionId: string
  workgroup: requests.athena.Workgroup
}

function ResultsContainerSkeleton({
  bucket,
  className,
  queryExecutionId,
  workgroup,
}: ResultsContainerSkeletonProps) {
  const classes = useResultsContainerStyles()
  return (
    <div className={className}>
      <ResultsBreadcrumbs
        bucket={bucket}
        className={classes.breadcrumbs}
        queryExecutionId={queryExecutionId}
        workgroup={workgroup}
      >
        <Skeleton height={24} width={144} animate />
      </ResultsBreadcrumbs>
      <TableSkeleton size={10} />
    </div>
  )
}

interface ResultsContainerProps {
  bucket: string
  className: string
  queryExecutionId: string
  queryResults: requests.athena.QueryResultsResponse
  workgroup: requests.athena.Workgroup
  onLoadMore?: () => void
}

function ResultsContainer({
  bucket,
  className,
  queryExecutionId,
  queryResults,
  onLoadMore,
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
        {!!queryResults.rows.length && (
          <CreatePackage bucket={bucket} queryResults={queryResults} />
        )}
      </ResultsBreadcrumbs>
      {/* eslint-disable-next-line no-nested-ternary */}
      {queryResults.rows.length ? (
        <Results
          rows={queryResults.rows}
          columns={queryResults.columns}
          onLoadMore={onLoadMore}
        />
      ) : // eslint-disable-next-line no-nested-ternary
      queryResults.queryExecution.error ? (
        <Alert error={queryResults.queryExecution.error} title="Query Results Data" />
      ) : queryResults.queryExecution ? (
        <History
          bucket={bucket}
          executions={[queryResults.queryExecution]}
          workgroup={workgroup}
        />
      ) : (
        <Alert
          error={new Error("Couldn't fetch query results")}
          title="Query Results Data"
        />
      )}
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

interface AthenaMainProps {
  bucket: string
  workgroup: string
}

function AthenaMain({ bucket, workgroup }: AthenaMainProps) {
  const classes = useStyles()
  return (
    <div className={classes.content}>
      <QueryConstructor
        bucket={bucket}
        className={classes.section}
        key={workgroup}
        workgroup={workgroup}
      />

      <HistoryContainer
        bucket={bucket}
        className={classes.section}
        workgroup={workgroup}
      />
    </div>
  )
}

interface AthenaExecutionProps {
  bucket: string
  queryExecutionId: string
  workgroup: string
}

function AthenaExecution({ bucket, workgroup, queryExecutionId }: AthenaExecutionProps) {
  const classes = useStyles()
  const results = useQueryResults(queryExecutionId)
  return (
    <div className={classes.content}>
      {results.data.case({
        Ok: (value) => (
          <QueryConstructor
            bucket={bucket}
            className={classes.section}
            queryExecutionId={queryExecutionId}
            initialValue={value?.queryExecution?.query}
            workgroup={workgroup}
          />
        ),
        _: () => (
          <>
            <div className={classes.section}>
              <Skeleton height={24} width={128} animate />
              <Skeleton height={48} mt={1} animate mb={3} />
            </div>
            <QueryEditor.Skeleton className={classes.section} />
          </>
        ),
      })}

      {results.data.case({
        Ok: (queryResults) => (
          <ResultsContainer
            bucket={bucket}
            className={classes.section}
            queryExecutionId={queryExecutionId}
            queryResults={queryResults}
            onLoadMore={
              queryResults.next ? () => results.loadMore(queryResults) : undefined
            }
            workgroup={workgroup}
          />
        ),
        _: () => (
          <ResultsContainerSkeleton
            bucket={bucket}
            className={classes.section}
            queryExecutionId={queryExecutionId}
            workgroup={workgroup}
          />
        ),
        Err: makeAsyncDataErrorHandler('Query Results Data'),
      })}
    </div>
  )
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
  const classes = useStyles()
  return (
    <>
      <M.Typography className={classes.header} variant="h6">
        Athena SQL
      </M.Typography>

      <Workgroups bucket={bucket} workgroup={workgroup || null} />

      {workgroup &&
        (queryExecutionId ? (
          <AthenaExecution
            bucket={bucket}
            queryExecutionId={queryExecutionId}
            workgroup={workgroup}
          />
        ) : (
          <AthenaMain bucket={bucket} workgroup={workgroup} />
        ))}
    </>
  )
}
