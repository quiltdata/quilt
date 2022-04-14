import * as React from 'react'
import * as M from '@material-ui/core'

import Perspective from 'components/Preview/renderers/Perspective'

import * as requests from '../requests'

interface EmptyProps {
  className: string
}

function Empty({ className }: EmptyProps) {
  return (
    <M.Paper className={className}>
      <M.Box p={3} textAlign="center">
        <M.Typography variant="h6">No results for this query</M.Typography>
        <M.Typography>
          Select another query execution or execute another query
        </M.Typography>
      </M.Box>
    </M.Paper>
  )
}

const config = { settings: true }

interface ResultsProps {
  className: string
  columns: requests.athena.QueryResultsColumns
  onLoadMore?: () => void
  rows: requests.athena.QueryResultsRows
}

export default function Results({ className, columns, rows, onLoadMore }: ResultsProps) {
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

  if (!data.length) return <Empty className={className} />

  return (
    <Perspective
      className={className}
      config={config}
      data={data}
      onLoadMore={onLoadMore}
      truncated={!!onLoadMore}
    />
  )
}
