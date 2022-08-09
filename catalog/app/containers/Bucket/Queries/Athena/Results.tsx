import * as React from 'react'
import * as M from '@material-ui/core'

import Perspective from 'components/Preview/renderers/Perspective'

import * as requests from '../requests'

function Empty() {
  return (
    <M.Paper>
      <M.Box p={3} textAlign="center">
        <M.Typography variant="h6">No results for this query</M.Typography>
        <M.Typography>
          Select another query execution or execute another query
        </M.Typography>
      </M.Box>
    </M.Paper>
  )
}

const useResultsStyles = M.makeStyles((t) => ({
  root: {
    padding: t.spacing(2),
  },
}))

interface ResultsProps {
  columns: requests.athena.QueryResultsColumns
  onLoadMore?: () => void
  rows: requests.athena.QueryResultsRows
}

export default function Results({ columns, rows, onLoadMore }: ResultsProps) {
  const classes = useResultsStyles()
  const data = React.useMemo(
    () =>
      rows.map((row) =>
        row.reduce(
          (memo, item, index) => ({
            ...memo,
            [columns[index]?.name || 'Unknown']: item,
          }),
          {},
        ),
      ),
    [columns, rows],
  )

  if (!data.length) return <Empty />

  return (
    <M.Paper className={classes.root}>
      <Perspective data={data} onLoadMore={onLoadMore} truncated={!!onLoadMore} />
    </M.Paper>
  )
}
