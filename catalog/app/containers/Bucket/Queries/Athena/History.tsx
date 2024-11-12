import cx from 'classnames'
import * as dateFns from 'date-fns'
import * as R from 'ramda'
import * as React from 'react'
import * as RRDom from 'react-router-dom'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import * as Notifications from 'containers/Notifications'
import * as NamedRoutes from 'utils/NamedRoutes'
import copyToClipboard from 'utils/clipboard'

import * as Model from './model'

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

interface CopyButtonProps {
  queryExecution: Model.QueryExecution
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
      <M.Icon fontSize="inherit">content_copy</M.Icon>
    </M.IconButton>
  )
}

const useFullQueryRowStyles = M.makeStyles((t) => ({
  queryRow: {
    alignItems: 'flex-start',
    borderBottom: `1px solid ${t.palette.divider}`,
    display: 'flex',
    padding: t.spacing(2, 2.5),
  },
  query: {
    margin: 0,
    maxHeight: t.spacing(30),
    maxWidth: '100%',
    overflow: 'auto',
    padding: t.spacing(0, 2),
    whiteSpace: 'pre-wrap',
  },
}))

interface FullQueryRowProps {
  expanded: boolean
  queryExecution: Model.QueryExecution
}

function FullQueryRow({ expanded, queryExecution }: FullQueryRowProps) {
  const classes = useFullQueryRowStyles()
  return (
    <M.Collapse in={expanded} unmountOnExit>
      <div className={classes.queryRow}>
        <CopyButton queryExecution={queryExecution} />
        <pre className={classes.query}>{queryExecution.query}</pre>
      </div>
    </M.Collapse>
  )
}

const useRowStyles = M.makeStyles((t) => ({
  root: {
    alignItems: 'center',
    display: 'grid',
    gridColumnGap: t.spacing(2),
    gridTemplateColumns: '30px auto 160px 160px 160px',
    padding: t.spacing(0, 2),
    lineHeight: `${t.spacing(4)}px`,
    borderBottom: `1px solid ${t.palette.divider}`,
    whiteSpace: 'nowrap',
  },
}))

interface RowProps {
  className: string
  children: React.ReactNode
}

function Row({ className, children }: RowProps) {
  const classes = useRowStyles()
  return <div className={cx(classes.root, className)}>{children}</div>
}

interface LinkCellProps {
  children: React.ReactNode
  className: string
  to?: string
}

function LinkCell({ children, className, to }: LinkCellProps) {
  if (to) {
    return (
      <RRDom.Link to={to} className={className}>
        {children}
      </RRDom.Link>
    )
  }
  return <span className={className}>{children}</span>
}

const useExecutionStyles = M.makeStyles((t) => ({
  hover: {
    '&:has($link:hover)': {
      background: t.palette.action.hover,
    },
  },
  failed: {
    color: t.palette.text.disabled,
  },
  link: {},
  query: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
}))

interface ExecutionProps {
  to?: string
  queryExecution: Model.QueryExecution
}

function Execution({ to, queryExecution }: ExecutionProps) {
  const classes = useExecutionStyles()
  const [expanded, setExpanded] = React.useState(false)
  const onToggle = React.useCallback(() => setExpanded(!expanded), [expanded])

  return (
    <>
      <Row className={to ? classes.hover : classes.failed}>
        <ToggleButton expanded={expanded} onClick={onToggle} />
        <LinkCell className={cx(classes.link, classes.query)} to={to}>
          {queryExecution.query}
        </LinkCell>
        <LinkCell className={classes.link} to={to}>
          <abbr title={queryExecution.id}>{queryExecution.status || 'UNKNOWN'}</abbr>
        </LinkCell>
        <LinkCell className={classes.link} to={to}>
          <Date date={queryExecution.created} />
        </LinkCell>
        <LinkCell className={classes.link} to={to}>
          <Date date={queryExecution.completed} />
        </LinkCell>
      </Row>
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
  header: {
    lineHeight: `${t.spacing(4.5)}px`,
    fontWeight: 'bold',
  },
  footer: {
    alignItems: 'center',
    display: 'flex',
    padding: t.spacing(1, 2),
  },
  more: {
    marginLeft: 'auto',
  },
}))

interface HistoryProps {
  bucket: string
  executions: Model.QueryExecution[]
  onLoadMore?: () => void
}

export default function History({ bucket, executions, onLoadMore }: HistoryProps) {
  const { urls } = NamedRoutes.use()
  const classes = useStyles()

  const pageSize = 10
  const [page, setPage] = React.useState(1)

  const handlePagination = React.useCallback(
    (_event, value) => {
      setPage(value)
    },
    [setPage],
  )

  const rowsSorted = React.useMemo(
    () =>
      R.sort(
        (a: Model.QueryExecution, b: Model.QueryExecution) =>
          b?.completed && a?.completed
            ? b.completed.valueOf() - a.completed.valueOf()
            : -1,
        executions,
      ),
    [executions],
  )
  const rowsPaginated = rowsSorted.slice(pageSize * (page - 1), pageSize * page)
  const hasPagination = rowsSorted.length > rowsPaginated.length

  const { workgroup } = Model.use()
  if (!Model.hasValue(workgroup)) return null

  return (
    <>
      <M.Paper>
        <Row className={classes.header}>
          <div />
          <span>Query</span>
          <span>Status</span>
          <span>Date created</span>
          <span>Date completed</span>
        </Row>
        {rowsPaginated.map((queryExecution) =>
          queryExecution.error ? (
            <Lab.Alert key={queryExecution.id} severity="warning">
              {queryExecution.error.message}
            </Lab.Alert>
          ) : (
            <Execution
              queryExecution={queryExecution}
              key={queryExecution.id}
              to={
                queryExecution.status === 'SUCCEEDED'
                  ? urls.bucketAthenaExecution(bucket, workgroup.data, queryExecution.id)
                  : undefined
              }
            />
          ),
        )}
        {!executions.length && <Empty />}
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
      </M.Paper>
    </>
  )
}
