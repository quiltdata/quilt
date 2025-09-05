import cx from 'classnames'
import * as R from 'ramda'
import * as React from 'react'
import * as RRDom from 'react-router-dom'
import * as M from '@material-ui/core'

import Code from 'components/Code'
import Placeholder from 'components/Placeholder'
import Skeleton from 'components/Skeleton'
import * as BucketPreferences from 'utils/BucketPreferences'
import * as NamedRoutes from 'utils/NamedRoutes'

import QuerySelect from '../QuerySelect'

import { Alert, Section } from './Components'
import * as QueryEditor from './QueryEditor'
import History from './History'
import Results from './Results'
import Workgroups from './Workgroups'
import * as Model from './model'
import { doQueryResultsContainManifestEntries } from './model/createPackage'

const CreatePackage = React.lazy(() => import('./CreatePackage'))

function SeeDocsForCreatingPackage() {
  return (
    <M.Tooltip title="You can create packages from the query results. Click to see the docs.">
      <a href="https://docs.quilt.bio/advanced/athena" target="_blank">
        <M.IconButton size="small">
          <M.Icon>help_outline</M.Icon>
        </M.IconButton>
      </a>
    </M.Tooltip>
  )
}

const useRelieveMessageStyles = M.makeStyles((t) => ({
  root: {
    padding: t.spacing(2),
  },
  text: {
    animation: '$show 0.3s ease-out',
  },
  '@keyframes show': {
    from: {
      opacity: 0,
    },
    to: {
      opacity: 1,
    },
  },
}))

const RELIEVE_INITIAL_TIMEOUT = 1000

interface RelieveMessageProps {
  className: string
  messages: string[]
}

function RelieveMessage({ className, messages }: RelieveMessageProps) {
  const classes = useRelieveMessageStyles()
  const [relieve, setRelieve] = React.useState('')
  const timersData = React.useMemo(
    () =>
      messages.map((message, index) => ({
        timeout: RELIEVE_INITIAL_TIMEOUT * (index + 1) ** 2,
        message,
      })),
    [messages],
  )
  React.useEffect(() => {
    const timers = timersData.map(({ timeout, message }) =>
      setTimeout(() => setRelieve(message), timeout),
    )
    return () => {
      timers.forEach((timer) => clearTimeout(timer))
    }
  }, [timersData])
  if (!relieve) return null
  return (
    <M.Paper className={cx(classes.root, className)}>
      <M.Typography className={classes.text} key={relieve} variant="caption">
        {relieve}
      </M.Typography>
    </M.Paper>
  )
}

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
  const { query, queries, queryRun } = Model.use()

  const selected = query.value
  const list = queries.data

  if (Model.isError(list)) {
    return <Alert className={className} error={list.error} title="Select query" />
  }

  if (!Model.isReady(list) || !Model.isReady(selected)) {
    return <QuerySelectSkeleton className={className} />
  }

  if (!list.data.list.length && !Model.isError(selected)) {
    return <M.Typography className={className}>No saved queries.</M.Typography>
  }

  return (
    <>
      <QuerySelect<Model.Query | null>
        label="Select a query"
        className={className}
        disabled={!Model.isReady(queryRun)}
        onChange={(v: Model.Query | null) =>
          query.setValue(v ? Model.Payload(v) : Model.None)
        }
        onLoadMore={list.data.next ? queries.loadMore : undefined}
        queries={list.data.list}
        value={Model.hasData(selected) ? selected.data : null}
      />
      {Model.isError(selected) && (
        <M.FormHelperText error>{selected.error.message}</M.FormHelperText>
      )}
    </>
  )
}

function HistoryContainer() {
  const { bucket, executions } = Model.use()

  const list = executions.data

  if (!Model.isReady(list)) return <TableSkeleton size={4} />

  if (Model.isError(list)) return <Alert error={list.error} title="Executions Data" />

  return (
    <History
      bucket={bucket}
      executions={list.data.list}
      onLoadMore={list.data.next ? executions.loadMore : undefined}
    />
  )
}

const useResultsContainerStyles = M.makeStyles((t) => ({
  breadcrumbs: {
    margin: t.spacing(0, 0, 1),
  },
  relieve: {
    left: '50%',
    position: 'absolute',
    top: t.spacing(7),
    transform: 'translateX(-50%)',
  },
  table: {
    position: 'relative',
  },
}))

interface ResultsContainerSkeletonProps {
  bucket: string
  className: string
}

const relieveMessages = [
  'Still loading…',
  'This is taking a moment. Thanks for your patience!',
  'Looks like a heavy task! We’re still working on it.',
  'Hang in there, we haven’t forgotten about you! Your request is still being processed.',
]

function ResultsContainerSkeleton({ bucket, className }: ResultsContainerSkeletonProps) {
  const classes = useResultsContainerStyles()
  return (
    <div className={className}>
      <ResultsBreadcrumbs bucket={bucket} className={classes.breadcrumbs}>
        <Skeleton height={24} width={144} animate />
      </ResultsBreadcrumbs>
      <div className={classes.table}>
        <TableSkeleton size={10} />
        <RelieveMessage className={classes.relieve} messages={relieveMessages} />
      </div>
    </div>
  )
}

interface ResultsContainerProps {
  className: string
}

function ResultsContainer({ className }: ResultsContainerProps) {
  const classes = useResultsContainerStyles()
  const { bucket, execution, results } = Model.use()

  const list = results.data

  if (!Model.isReady(execution) || !Model.isReady(list)) {
    return <ResultsContainerSkeleton bucket={bucket} className={className} />
  }

  if (Model.isError(execution)) {
    return (
      <div className={className}>
        <ResultsBreadcrumbs bucket={bucket} className={classes.breadcrumbs} />
        <Alert error={execution.error} title="Query execution" className={className} />
      </div>
    )
  }

  if (Model.isError(list)) {
    return (
      <div className={className}>
        <ResultsBreadcrumbs bucket={bucket} className={classes.breadcrumbs} />
        <Alert error={list.error} title="Query results" className={className} />
      </div>
    )
  }

  return (
    <div className={className}>
      <ResultsBreadcrumbs bucket={bucket} className={classes.breadcrumbs}>
        {doQueryResultsContainManifestEntries(list.data) ? (
          <React.Suspense fallback={<M.CircularProgress />}>
            <CreatePackage bucket={bucket} queryResults={list.data} />
          </React.Suspense>
        ) : (
          <SeeDocsForCreatingPackage />
        )}
      </ResultsBreadcrumbs>
      <Results
        rows={list.data.rows}
        columns={list.data.columns}
        onLoadMore={list.data.next ? results.loadMore : undefined}
      />
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
    margin: '-3px 0 -3px auto',
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
  children?: React.ReactNode
  className?: string
}

function ResultsBreadcrumbs({ bucket, children, className }: ResultsBreadcrumbsProps) {
  const { workgroup, queryExecutionId } = Model.use()
  const classes = useResultsBreadcrumbsStyles()
  const overrideClasses = useOverrideStyles()
  const { urls } = NamedRoutes.use()
  return (
    <div className={cx(classes.root, className)}>
      <M.Breadcrumbs classes={overrideClasses}>
        <RRDom.Link
          className={classes.breadcrumb}
          to={urls.bucketAthenaWorkgroup(bucket, workgroup.data)}
        >
          Query Executions
        </RRDom.Link>
        <M.Typography className={classes.breadcrumb} color="textPrimary">
          Results for<Code className={classes.id}>{queryExecutionId}</Code>
        </M.Typography>
      </M.Breadcrumbs>

      {children && <div className={classes.actions}>{children}</div>}
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

function AthenaContainer() {
  const { bucket, queryExecutionId, workgroup } = Model.use()

  const classes = useStyles()
  return (
    <>
      <M.Typography className={classes.header} variant="h6">
        Athena SQL
      </M.Typography>

      <Workgroups bucket={bucket} />

      {Model.hasData(workgroup.data) && (
        <div className={classes.content}>
          <div className={classes.section}>
            <QueryConstructor />
            <QueryEditor.Form className={classes.form} />
          </div>
          {queryExecutionId ? (
            <ResultsContainer className={classes.section} />
          ) : (
            <Section title="Query executions" className={classes.section}>
              <HistoryContainer />
            </Section>
          )}
        </div>
      )}
    </>
  )
}

export default function Wrapper() {
  const { prefs } = BucketPreferences.use()
  return BucketPreferences.Result.match(
    {
      Ok: ({ ui }) => (
        <Model.Provider preferences={ui.athena}>
          <AthenaContainer />
        </Model.Provider>
      ),
      _: () => <Placeholder color="inherit" />,
    },
    prefs,
  )
}
