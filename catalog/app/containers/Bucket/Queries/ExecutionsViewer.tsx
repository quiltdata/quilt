import * as dateFns from 'date-fns'
import * as React from 'react'
import * as M from '@material-ui/core'

import * as requests from './requests'

interface ExecutionProps {
  queryExecution: requests.QueryExecution
}

function Execution({ queryExecution }: ExecutionProps) {
  const [expanded, setExpanded] = React.useState(false)

  const onToggle = React.useCallback(() => setExpanded(!expanded), [expanded])

  return (
    <>
      <M.TableRow>
        <M.TableCell onClick={onToggle}>
          {queryExecution.query?.length <= 30
            ? queryExecution.query
            : `${queryExecution.query?.substring(0, 20)} … ${queryExecution.query?.substr(
                -10,
              )}`}
        </M.TableCell>
        <M.TableCell>
          <abbr title={queryExecution.id}>{queryExecution.status}</abbr>
        </M.TableCell>
        <M.TableCell style={{ whiteSpace: 'nowrap' }}>
          {queryExecution.created
            ? dateFns.format(queryExecution.created, 'MMM do, HH:mm:ss')
            : null}
        </M.TableCell>
        <M.TableCell style={{ whiteSpace: 'nowrap' }}>
          {queryExecution.completed
            ? dateFns.format(queryExecution.completed, 'MMM do, HH:mm:ss')
            : null}
        </M.TableCell>
      </M.TableRow>
      <M.TableRow>
        <M.Collapse in={expanded}>
          <M.TableCell>{queryExecution.query}</M.TableCell>
        </M.Collapse>
      </M.TableRow>
    </>
  )
}

interface ExecutionsViewerProps {
  executions: requests.QueryExecution[]
}

export default function ExecutionsViewer({ executions }: ExecutionsViewerProps) {
  return (
    <M.TableContainer component={M.Paper}>
      <M.Table size="small">
        <M.TableHead>
          <M.TableRow>
            <M.TableCell>Query</M.TableCell>
            <M.TableCell>Status</M.TableCell>
            <M.TableCell>Date created</M.TableCell>
            <M.TableCell>Date completed</M.TableCell>
          </M.TableRow>
        </M.TableHead>
        <M.TableBody>
          {executions.map((queryExecution) => (
            <Execution queryExecution={queryExecution} />
          ))}
        </M.TableBody>
      </M.Table>
    </M.TableContainer>
  )
}
