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
import { trimCenter } from 'utils/string'

import * as requests from '../requests'

const useToggleButtonStyles = M.makeStyles({
  root: {
    transition: 'ease transform .15s',
  },
  expanded: {
    transform: 'rotate(90deg)',
  },
})

interface ToggleButtonProps {
  expanded: boolean
  onClick: () => void
}

function ToggleButton({ expanded, onClick }: ToggleButtonProps) {
  const classes = useToggleButtonStyles()
  return (
    <M.IconButton
      onClick={onClick}
      size="small"
      className={cx(classes.root, { [classes.expanded]: expanded })}
    >
      <M.Icon>keyboard_arrow_right</M.Icon>
    </M.IconButton>
  )
}

const useDateStyles = M.makeStyles({
  root: {
    whiteSpace: 'nowrap',
  },
})
interface DateProps {
  date?: Date
}

function Date({ date }: DateProps) {
  const classes = useDateStyles()
  const formatted = React.useMemo(
    () => (date ? dateFns.format(date, 'MMM do, HH:mm:ss') : null),
    [date],
  )
  return <span className={classes.root}>{formatted}</span>
}

interface QueryDateCompletedProps {
  bucket: string
  queryExecution: requests.athena.QueryExecution
  workgroup: requests.athena.Workgroup
}

function QueryDateCompleted({
  bucket,
  queryExecution,
  workgroup,
}: QueryDateCompletedProps) {
  const { urls } = NamedRoutes.use()
  if (queryExecution.status !== 'SUCCEEDED') {
    return <Date date={queryExecution.completed} />
  }
  return (
    <Link to={urls.bucketAthenaExecution(bucket, workgroup, queryExecution.id)}>
      <Date date={queryExecution.completed} />
    </Link>
  )
}

interface CopyButtonProps {
  queryExecution: requests.athena.QueryExecution
}

function CopyButton({ queryExecution }: CopyButtonProps) {
  const { push } = Notifications.use()
  const handleCopy = React.useCallback(() => {
    if (queryExecution.query) {
      copyToClipboard(queryExecution.query)
      push('Query has been copied to clipboard')
    }
  }, [push, queryExecution.query])
  return (
    <M.IconButton onClick={handleCopy} size="small">
      <M.Icon>content_copy</M.Icon>
    </M.IconButton>
  )
}

const useFullQueryRowStyles = M.makeStyles((t) => ({
  cell: {
    paddingBottom: 0,
    paddingTop: 0,
  },
  collapsed: {
    borderBottom: 0,
  },
  query: {
    maxHeight: t.spacing(30),
    maxWidth: '100%',
    overflow: 'auto',
  },
}))

interface FullQueryRowProps {
  expanded: boolean
  queryExecution: requests.athena.QueryExecution
}

function FullQueryRow({ expanded, queryExecution }: FullQueryRowProps) {
  const classes = useFullQueryRowStyles()
  return (
    <M.TableRow>
      <M.TableCell
        padding="checkbox"
        className={cx(classes.cell, {
          [classes.collapsed]: !expanded,
        })}
      >
        {!!expanded && <CopyButton queryExecution={queryExecution} />}
      </M.TableCell>
      <M.TableCell
        colSpan={4}
        className={cx(classes.cell, { [classes.collapsed]: !expanded })}
      >
        <M.Collapse in={expanded}>
          <pre className={classes.query}>{queryExecution.query}</pre>
        </M.Collapse>
      </M.TableCell>
    </M.TableRow>
  )
}

interface ExecutionProps {
  bucket: string
  queryExecution: requests.athena.QueryExecution
  workgroup: requests.athena.Workgroup
}

function Execution({ bucket, queryExecution, workgroup }: ExecutionProps) {
  const [expanded, setExpanded] = React.useState(false)
  const onToggle = React.useCallback(() => setExpanded(!expanded), [expanded])

  return (
    <>
      <M.TableRow>
        <M.TableCell padding="checkbox">
          <ToggleButton expanded={expanded} onClick={onToggle} />
        </M.TableCell>
        <M.TableCell>{trimCenter(queryExecution.query, 50)}</M.TableCell>
        <M.TableCell>
          <abbr title={queryExecution.id}>{queryExecution.status}</abbr>
        </M.TableCell>
        <M.TableCell>
          <Date date={queryExecution.created} />
        </M.TableCell>
        <M.TableCell>
          <QueryDateCompleted
            queryExecution={queryExecution}
            bucket={bucket}
            workgroup={workgroup}
          />
        </M.TableCell>
      </M.TableRow>
      {queryExecution.query && (
        <FullQueryRow expanded={expanded} queryExecution={queryExecution} />
      )}
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
    width: '24px',
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
