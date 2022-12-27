import * as R from 'ramda'
import * as React from 'react'
import type { RegularTableElement } from 'regular-table'
import * as M from '@material-ui/core'

import Perspective from 'components/Preview/renderers/Perspective'
import * as NamedRoutes from 'utils/NamedRoutes'
import * as s3paths from 'utils/s3paths'

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

export function useLinkProcessor() {
  const { urls } = NamedRoutes.use()
  return React.useCallback(
    (s3Url) => {
      const handle = s3paths.parseS3Url(s3Url)
      return urls.bucketFile(handle.bucket, handle.key, { version: handle.version })
    },
    [urls],
  )
}

const useResultsStyles = M.makeStyles((t) => ({
  root: {
    padding: t.spacing(2),
  },
}))

interface ResultsProps {
  className?: string
  columns: requests.athena.QueryResultsColumns
  onLoadMore?: () => void
  rows: requests.athena.QueryResultsRows
}

export default function Results({ className, columns, onLoadMore, rows }: ResultsProps) {
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

  const processLink = useLinkProcessor()

  const onRenderCell = React.useCallback(
    ({ detail }: { detail: RegularTableElement }) => {
      detail.querySelectorAll('td').forEach((td) => {
        const meta = detail.getMeta(td)
        if (!meta.column_header || !meta.value || typeof meta.value !== 'string') return
        const column = R.last(meta.column_header)
        if (column === 'physical_keys') {
          const key = meta.value.replace(/^\[/, '').replace(/\]$/, '')
          td.innerHTML = `<a href="${processLink(key)}">${key}</a>`
        }
      })
    },
    [processLink],
  )

  if (!data.length) return <Empty />

  return (
    <M.Paper className={classes.root}>
      <Perspective
        className={className}
        data={data}
        onLoadMore={onLoadMore}
        truncated={!!onLoadMore}
        onRenderCell={onRenderCell}
      />
    </M.Paper>
  )
}
