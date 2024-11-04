import cx from 'classnames'
import * as R from 'ramda'
import * as React from 'react'
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
import History from './History'
import Results from './Results'
import * as State from './State'
import Workgroups from './Workgroups'
import * as Model from './model'

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
  const { query, queries } = State.use()

  if (Model.isError(queries.data)) {
    return makeAsyncDataErrorHandler('Select query')(queries.data)
  }

  if (!Model.hasData(queries.data) || !Model.isObtained(query.value)) {
    return <QuerySelectSkeleton className={className} />
  }

  return (
    <Section
      className={className}
      title="Select query"
      empty="There are no saved queries."
    >
      {!!queries.data.list.length && (
        <QuerySelect<requests.athena.AthenaQuery | null>
          onChange={query.setValue}
          onLoadMore={queries.data.next ? queries.loadMore : undefined}
          queries={queries.data.list}
          value={Model.isError(query.value) ? null : query.value}
        />
      )}
      {Model.isError(query.value) && (
        <M.FormHelperText error>{query.value.message}</M.FormHelperText>
      )}
    </Section>
  )
}

interface HistoryContainerProps {
  bucket: string
}

function HistoryContainer({ bucket }: HistoryContainerProps) {
  const { executions } = State.use()
  if (Model.isError(executions.data)) {
    return makeAsyncDataErrorHandler('Executions Data')(executions.data)
  }
  if (!Model.hasData(executions.data)) {
    return <TableSkeleton size={4} />
  }
  return (
    <History
      bucket={bucket}
      executions={executions.data.list}
      onLoadMore={executions.data.next ? executions.loadMore : undefined}
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
  execution: requests.athena.QueryExecution
}

function ResultsContainer({
  bucket,
  className,
  queryResults,
  onLoadMore,
  execution,
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
      execution.error ? (
        <Alert error={execution.error} title="Query Results Data" />
      ) : execution ? (
        <History bucket={bucket} executions={[execution]} />
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
  const { execution, results } = State.use()
  // TODO: execution and results independent
  if (Model.isError(execution)) {
    return makeAsyncDataErrorHandler('Query Results Data')(execution)
  }
  if (Model.isError(results.data)) {
    return makeAsyncDataErrorHandler('Query Results Data')(results.data)
  }
  if (!Model.hasData(execution) || !Model.hasValue(results.data)) {
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
        execution={execution}
        className={classes.section}
        queryResults={results.data}
        onLoadMore={results.data.next ? results.loadMore : undefined}
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
