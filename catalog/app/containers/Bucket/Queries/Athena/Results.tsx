import * as R from 'ramda'
import * as React from 'react'
import * as RRDom from 'react-router-dom'
import type { RegularTableElement } from 'regular-table'
import * as M from '@material-ui/core'

import Perspective from 'components/Preview/renderers/Perspective'
import log from 'utils/Logging'
import * as NamedRoutes from 'utils/NamedRoutes'
import * as s3paths from 'utils/s3paths'

import * as Model from './model'

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

function useLinkProcessor() {
  const { urls } = NamedRoutes.use()
  const history = RRDom.useHistory()
  return React.useCallback(
    (tableEl: RegularTableElement) => {
      tableEl.querySelectorAll('td').forEach((td) => {
        const meta = tableEl.getMeta(td)
        if (!meta) return
        if (!meta.column_header || !meta.value || typeof meta.value !== 'string') return
        const column = R.last(meta.column_header)
        if (column !== 'physical_keys') return
        // addStyleListener re-fires on every scroll/sort/resize; skip cells we
        // already linkified this render to avoid rebuilding/duplicating anchors.
        if (td.firstChild instanceof HTMLAnchorElement) return

        try {
          const s3Url = meta.value.replace(/^\[/, '').replace(/\]$/, '')
          const handle = s3paths.parseS3Url(s3Url)
          const url = urls.bucketFile(handle.bucket, handle.key, {
            version: handle.version,
          })

          const link = document.createElement('a')
          // Real href so the cell reads as a link (cmd/ctrl-click, open in new
          // tab); preventDefault keeps plain clicks on SPA history navigation.
          link.href = url
          link.style.cursor = 'pointer'
          link.textContent = s3Url
          link.addEventListener('click', (e) => {
            e.preventDefault()
            history.push(url)
          })
          td.replaceChildren(link)
        } catch (error) {
          log.warn(error)
        }
      })
    },
    [history, urls],
  )
}

const useResultsStyles = M.makeStyles((t) => ({
  root: {
    padding: t.spacing(2),
  },
}))

interface ResultsProps {
  className?: string
  columns: Model.QueryResultsColumns
  onLoadMore?: () => void
  rows: Model.QueryResultsRows
}

export default function Results({ className, columns, onLoadMore, rows }: ResultsProps) {
  const classes = useResultsStyles()
  const data = React.useMemo(
    () =>
      rows.map((row) =>
        row.reduce<Record<string, unknown>>(
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

  if (!data.length) return <Empty />

  return (
    <M.Paper className={classes.root}>
      <Perspective
        className={className}
        data={data}
        onLoadMore={onLoadMore}
        truncated={!!onLoadMore}
        onRender={processLink}
      />
    </M.Paper>
  )
}
