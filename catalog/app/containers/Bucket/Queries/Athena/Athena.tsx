import cx from 'classnames'
import * as R from 'ramda'
import * as React from 'react'
import * as RRDom from 'react-router-dom'
import * as M from '@material-ui/core'

import Code from 'components/Code'
import Skeleton from 'components/Skeleton'
import * as Model from 'model'
import * as NamedRoutes from 'utils/NamedRoutes'

import QuerySelect from '../QuerySelect'
import * as requests from '../requests'

import { Alert, Section, makeAsyncDataErrorHandler } from './Components'
import CreatePackage from './CreatePackage'
import * as QueryEditor from './QueryEditor'
import History from './History'
import Results from './Results'
import * as State from './State'
import Workgroups from './Workgroups'

interface QuerySelectSkeletonProps {
  className?: string
}

function QuerySelectSkeleton({ className }: QuerySelectSkeletonProps) {
  return (
    <div className={className}>
      <Skeleton height={24} width={128} animate />
      <Skeleton height={48} mt={1} animate />
    </div>
  )
}

interface QueryConstructorProps {
  className?: string
}

function QueryConstructor({ className }: QueryConstructorProps) {
  const { query, setQuery, queries, onQueriesMore } = State.use()

  if (Model.isError(queries)) {
    return makeAsyncDataErrorHandler('Select query')(queries)
  }

  if (!Model.isData(queries) || !Model.isValueResolved(query)) {
    return <QuerySelectSkeleton className={className} />
  }

  const queryError = Model.takeError(query)

  return (
    <Section
      className={className}
      title="Select query"
      empty="There are no saved queries."
    >
      {!!queries.list.length && (
        <QuerySelect<requests.athena.AthenaQuery | null>
          onChange={setQuery}
          onLoadMore={queries.next ? onQueriesMore : undefined}
          queries={queries.list}
          value={Model.isError(query) ? null : query}
        />
      )}
      {queryError && <M.FormHelperText error>{queryError.message}</M.FormHelperText>}
    </Section>
  )
}

interface HistoryContainerProps {
  bucket: string
}

function HistoryContainer({ bucket }: HistoryContainerProps) {
  const { executions, onExecutionsMore } = State.use()
  if (Model.isError(executions)) {
    return makeAsyncDataErrorHandler('Executions Data')(executions)
  }
  if (!Model.isData(executions)) {
    return <TableSkeleton size={4} />
  }
  return (
    <History
      bucket={bucket}
      executions={executions.list}
      onLoadMore={executions.next ? onExecutionsMore : undefined}
    />
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
}

function ResultsContainerSkeleton({ bucket, className }: ResultsContainerSkeletonProps) {
  const classes = useResultsContainerStyles()
  return (
    <div className={className}>
      <ResultsBreadcrumbs bucket={bucket} className={classes.breadcrumbs}>
        <Skeleton height={24} width={144} animate />
      </ResultsBreadcrumbs>
      <TableSkeleton size={10} />
    </div>
  )
}

interface ResultsContainerProps {
  bucket: string
  className: string
  queryResults: requests.athena.QueryResultsResponse
  onLoadMore?: () => void
}

function ResultsContainer({
  bucket,
  className,
  queryResults,
  onLoadMore,
}: ResultsContainerProps) {
  const classes = useResultsContainerStyles()
  return (
    <div className={className}>
      <ResultsBreadcrumbs bucket={bucket} className={classes.breadcrumbs}>
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
        <History bucket={bucket} executions={[queryResults.queryExecution]} />
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

// interface QueryResults {
//   data: requests.AsyncData<requests.athena.QueryResultsResponse>
//   loadMore: (prev: requests.athena.QueryResultsResponse) => void
// }

// function useQueryResults(queryExecutionId?: string): QueryResults {
//   const [prev, setPrev] = React.useState<requests.athena.QueryResultsResponse | null>(
//     null,
//   )
//   const data = requests.athena.useQueryResults(queryExecutionId || null, prev)
//   return React.useMemo(() => ({ data, loadMore: setPrev }), [data])
// }

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
}

function ResultsBreadcrumbs({ bucket, children, className }: ResultsBreadcrumbsProps) {
  const { workgroup, queryExecutionId } = State.use()
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
  form: {
    margin: t.spacing(3, 0, 0),
  },
}))

interface AthenaMainProps {
  bucket: string
}

function AthenaMain({ bucket }: AthenaMainProps) {
  const classes = useStyles()
  return (
    <div className={classes.content}>
      <div className={classes.section}>
        <QueryConstructor />
        <QueryEditor.Form className={classes.form} />
      </div>
      <Section title="Query executions" className={classes.section}>
        <HistoryContainer bucket={bucket} />
      </Section>
    </div>
  )
}

interface AthenaExecutionProps {
  bucket: string
}

function AthenaExecution({ bucket }: AthenaExecutionProps) {
  const classes = useStyles()
  // const results = useQueryResults(queryExecutionId)
  const { execution, results, onResultsMore } = State.use()
  // TODO: execution and results independent
  if (Model.isError(execution)) {
    return makeAsyncDataErrorHandler('Query Results Data')(execution)
  }
  if (Model.isError(results)) {
    return makeAsyncDataErrorHandler('Query Results Data')(results)
  }
  if (!Model.isFulfilled(execution) || !Model.isFulfilled(results)) {
    return (
      <div className={classes.content}>
        <QuerySelectSkeleton className={classes.section} />
        <ResultsContainerSkeleton bucket={bucket} className={classes.section} />
      </div>
    )
  }
  return (
    <div className={classes.content}>
      <div className={classes.section}>
        <QueryConstructor />
        <QueryEditor.Form className={classes.form} />
      </div>

      <ResultsContainer
        bucket={bucket}
        className={classes.section}
        queryResults={results}
        onLoadMore={results.next ? onResultsMore : undefined}
      />
    </div>
  )
}

function AthenaContainer() {
  const { bucket, queryExecutionId } = State.use()

  const classes = useStyles()
  return (
    <>
      <M.Typography className={classes.header} variant="h6">
        Athena SQL
      </M.Typography>

      <Workgroups bucket={bucket} />

      {queryExecutionId ? (
        <AthenaExecution bucket={bucket} />
      ) : (
        <AthenaMain bucket={bucket} />
      )}
    </>
  )
}

export default function Wrapper() {
  return (
    <State.Provider>
      <AthenaContainer />
    </State.Provider>
  )
}
