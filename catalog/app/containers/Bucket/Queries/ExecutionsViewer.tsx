import * as dateFns from 'date-fns'
import * as React from 'react'
import * as M from '@material-ui/core'

import * as NamedRoutes from 'utils/NamedRoutes'
import Link from 'utils/StyledLink'

import * as requests from './requests'

const useExecutionStyles = M.makeStyles((t) => ({
  date: {
    whiteSpace: 'nowrap',
  },
  expandedCell: {
    paddingBottom: 0,
    paddingTop: 0,
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
  queryExecution: requests.QueryExecution
}

function Execution({ bucket, queryExecution }: ExecutionProps) {
  const classes = useExecutionStyles()

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
    [queryExecution],
  )

  const completed = queryExecution.completed
    ? dateFns.format(queryExecution.completed, 'MMM do, HH:mm:ss')
    : null

  return (
    <>
      <M.TableRow>
        <M.TableCell style={{ width: '50%' }} onClick={onToggle}>
          {trimmedQuery}
        </M.TableCell>
        <M.TableCell align="right">
          <abbr title={queryExecution.id}>{queryExecution.status}</abbr>
        </M.TableCell>
        <M.TableCell align="right" className={classes.date}>
          {queryExecution.created
            ? dateFns.format(queryExecution.created, 'MMM do, HH:mm:ss')
            : null}
        </M.TableCell>
        <M.TableCell align="right" className={classes.date}>
          {queryExecution.status === 'SUCCEEDED' ? (
            <Link to={urls.bucketAthenaQueryExecution(bucket, queryExecution.id)}>
              {completed}
            </Link>
          ) : (
            completed
          )}
        </M.TableCell>
      </M.TableRow>
      <M.TableRow>
        <M.TableCell colSpan={4} className={classes.expandedCell}>
          <M.Collapse in={expanded}>
            <pre className={classes.expandedQuery}>{queryExecution.query}</pre>
          </M.Collapse>
        </M.TableCell>
      </M.TableRow>
    </>
  )
}

const useStyles = M.makeStyles({
  table: {
    tableLayout: 'fixed',
  },
})

interface ExecutionsViewerProps {
  bucket: string
  className?: string
  executions: requests.QueryExecution[]
}

export default function ExecutionsViewer({
  bucket,
  className,
  executions,
}: ExecutionsViewerProps) {
  const classes = useStyles()

  return (
    <M.TableContainer component={M.Paper} className={className}>
      <M.Table size="small" className={classes.table}>
        <M.TableHead>
          <M.TableRow>
            <M.TableCell style={{ width: '50%' }}>Query</M.TableCell>
            <M.TableCell align="right">Status</M.TableCell>
            <M.TableCell align="right">Date created</M.TableCell>
            <M.TableCell align="right">Date completed</M.TableCell>
          </M.TableRow>
        </M.TableHead>
        <M.TableBody>
          {executions.map((queryExecution) => (
            <Execution
              bucket={bucket}
              queryExecution={queryExecution}
              key={queryExecution.id}
            />
          ))}
          {!executions.length && (
            <M.TableRow>
              <M.TableCell colSpan={4}>
                <M.Box p={3} textAlign="center">
                  <M.Typography variant="h6">
                    No executions for this workgroup
                  </M.Typography>
                  <M.Typography>
                    Select another workgroup or execute some query
                  </M.Typography>
                </M.Box>
              </M.TableCell>
            </M.TableRow>
          )}
        </M.TableBody>
      </M.Table>
    </M.TableContainer>
  )
}
