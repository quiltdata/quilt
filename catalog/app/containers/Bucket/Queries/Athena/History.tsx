import cx from 'classnames'
import * as dateFns from 'date-fns'
import * as R from 'ramda'
import * as React from 'react'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import * as Notifications from 'containers/Notifications'
import * as NamedRoutes from 'utils/NamedRoutes'
import Link from 'utils/StyledLink'
import copyToClipboard from 'utils/clipboard'

import * as requests from '../requests'

const useExecutionStyles = M.makeStyles((t) => ({
  date: {
    whiteSpace: 'nowrap',
  },
  queryCell: {
    width: '40%',
  },
  collapsedCell: {
    borderBottom: 0,
  },
  expandingCell: {
    paddingBottom: 0,
    paddingTop: 0,
  },
  toggle: {
    transition: 'ease transform .15s',
  },
  actionCell: {
    width: '46px',
    paddingLeft: t.spacing(2),
    paddingRight: 0,
  },
  expandedToggle: {
    transform: 'rotate(90deg)',
  },
  expandedQuery: {
    maxHeight: t.spacing(30),
    maxWidth: '100%',
    overflow: 'auto',
    padding: t.spacing(1),
  },
}))

interface ExecutionProps {
  bucket: string
  queryExecution: requests.athena.QueryExecution
  workgroup: requests.athena.Workgroup
}

function Execution({ bucket, queryExecution, workgroup }: ExecutionProps) {
  const classes = useExecutionStyles()
  const { push } = Notifications.use()

  const { urls } = NamedRoutes.use()

  const [expanded, setExpanded] = React.useState(false)

  const onToggle = React.useCallback(() => setExpanded(!expanded), [expanded])
  const trimmedQuery = React.useMemo(
    () =>
      !queryExecution.query || queryExecution.query.length <= 30
        ? queryExecution.query
        : `${queryExecution.query?.substring(0, 30)} … ${queryExecution.query?.substr(
            -20,
          )}`,
    [queryExecution.query],
  )

  const completed = React.useMemo(
    () =>
      queryExecution.completed
        ? dateFns.format(queryExecution.completed, 'MMM do, HH:mm:ss')
        : null,
    [queryExecution.completed],
  )

  const handleCopy = React.useCallback(() => {
    if (queryExecution.query) {
      copyToClipboard(queryExecution.query)
      push('Query has been copied to clipboard')
    }
  }, [push, queryExecution.query])

  return (
    <>
      <M.TableRow>
        <M.TableCell className={classes.actionCell}>
          <M.IconButton
            onClick={onToggle}
            size="small"
            className={cx(classes.toggle, { [classes.expandedToggle]: expanded })}
          >
            <M.Icon>keyboard_arrow_right</M.Icon>
          </M.IconButton>
        </M.TableCell>
        <M.TableCell className={classes.queryCell}>{trimmedQuery}</M.TableCell>
        <M.TableCell>
          <abbr title={queryExecution.id}>{queryExecution.status}</abbr>
        </M.TableCell>
        <M.TableCell className={classes.date}>
          {queryExecution.created
            ? dateFns.format(queryExecution.created, 'MMM do, HH:mm:ss')
            : null}
        </M.TableCell>
        <M.TableCell className={classes.date}>
          {queryExecution.status === 'SUCCEEDED' ? (
            <Link to={urls.bucketAthenaExecution(bucket, workgroup, queryExecution.id)}>
              {completed}
            </Link>
          ) : (
            completed
          )}
        </M.TableCell>
      </M.TableRow>
      <M.TableRow>
        <M.TableCell
          className={cx(classes.actionCell, classes.expandingCell, {
            [classes.collapsedCell]: !expanded,
          })}
        >
          <M.Collapse in={expanded}>
            {queryExecution.query && (
              <M.IconButton onClick={handleCopy} size="small">
                <M.Icon>content_copy</M.Icon>
              </M.IconButton>
            )}
          </M.Collapse>
        </M.TableCell>
        <M.TableCell
          colSpan={4}
          className={cx(classes.expandingCell, { [classes.collapsedCell]: !expanded })}
        >
          <M.Collapse in={expanded}>
            <pre className={classes.expandedQuery}>{queryExecution.query}</pre>
          </M.Collapse>
        </M.TableCell>
      </M.TableRow>
    </>
  )
}

function Empty() {
  return (
    <M.Box p={3} textAlign="center">
      <M.Typography variant="h6">No executions for this workgroup</M.Typography>
      <M.Typography>Select another workgroup or execute some query</M.Typography>
    </M.Box>
  )
}

const useStyles = M.makeStyles((t) => ({
  queryCell: {
    width: '40%',
  },
  actionCell: {
    width: '46px',
    paddingLeft: t.spacing(2),
    paddingRight: 0,
  },
  header: {
    margin: t.spacing(0, 0, 1),
  },
  footer: {
    display: 'flex',
    padding: t.spacing(1),
  },
  more: {
    marginLeft: 'auto',
  },
  table: {
    tableLayout: 'fixed',
  },
}))

interface HistoryProps {
  bucket: string
  executions: requests.athena.QueryExecution[]
  onLoadMore?: () => void
  workgroup: requests.athena.Workgroup
}

export default function History({
  bucket,
  executions,
  onLoadMore,
  workgroup,
}: HistoryProps) {
  const classes = useStyles()

  const pageSize = 10
  const [page, setPage] = React.useState(1)

  const handlePagination = React.useCallback(
    (event, value) => {
      setPage(value)
    },
    [setPage],
  )

  const rowsSorted = React.useMemo(
    () =>
      R.sort(
        (a: requests.athena.QueryExecution, b: requests.athena.QueryExecution) =>
          b?.completed && a?.completed
            ? b.completed.valueOf() - a.completed.valueOf()
            : -1,
        executions,
      ),
    [executions],
  )
  const rowsPaginated = rowsSorted.slice(pageSize * (page - 1), pageSize * page)
  const hasPagination = rowsSorted.length > rowsPaginated.length

  return (
    <M.TableContainer component={M.Paper}>
      <M.Table size="small" className={classes.table}>
        <M.TableHead>
          <M.TableRow>
            <M.TableCell className={classes.actionCell} />
            <M.TableCell className={classes.queryCell}>Query</M.TableCell>
            <M.TableCell>Status</M.TableCell>
            <M.TableCell>Date created</M.TableCell>
            <M.TableCell>Date completed</M.TableCell>
          </M.TableRow>
        </M.TableHead>
        <M.TableBody>
          {rowsPaginated.map((queryExecution) => (
            <Execution
              bucket={bucket}
              queryExecution={queryExecution}
              key={queryExecution.id}
              workgroup={workgroup}
            />
          ))}
          {!executions.length && (
            <M.TableRow>
              <M.TableCell colSpan={4}>
                <Empty />
              </M.TableCell>
            </M.TableRow>
          )}
        </M.TableBody>
      </M.Table>

      {(hasPagination || !!onLoadMore) && (
        <div className={classes.footer}>
          {hasPagination && (
            <Lab.Pagination
              count={Math.ceil(executions.length / pageSize)}
              page={page}
              size="small"
              onChange={handlePagination}
            />
          )}
          {onLoadMore && (
            <M.Button className={classes.more} size="small" onClick={onLoadMore}>
              Load more
            </M.Button>
          )}
        </div>
      )}
    </M.TableContainer>
  )
}
