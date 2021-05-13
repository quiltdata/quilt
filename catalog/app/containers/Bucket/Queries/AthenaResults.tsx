import * as React from 'react'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import * as requests from './requests'

const useStyles = M.makeStyles((t) => ({
  footer: {
    display: 'flex',
    padding: t.spacing(1),
  },
  more: {
    marginLeft: 'auto',
  },
}))

interface AthenaResultsProps {
  results: requests.athena.QueryResults
}

export default function AthenaResults({ results }: AthenaResultsProps) {
  const classes = useStyles()

  const rows = results?.ResultSet?.Rows
  const head = rows?.[0]
  const tail = rows?.slice(1)

  const pageSize = 10
  const [page, setPage] = React.useState(1)

  const handlePagination = React.useCallback(
    (event, value) => {
      setPage(value)
    },
    [setPage],
  )

  if (!tail) return null

  const rowsPaginated = tail.slice(pageSize * (page - 1), pageSize * page)
  const hasPagination = tail.length > rowsPaginated.length

  const onLoadMore = undefined

  /* eslint-disable react/no-array-index-key */

  return (
    <M.TableContainer component={M.Paper}>
      <M.Table size="small">
        <M.TableHead>
          <M.TableRow>
            {head?.Data &&
              head.Data.map((item, index) => (
                <M.TableCell key={index}>{item.VarCharValue}</M.TableCell>
              ))}
          </M.TableRow>
        </M.TableHead>
        <M.TableBody>
          {rowsPaginated.map((row, rowIndex) => (
            <M.TableRow key={rowIndex}>
              {row.Data &&
                row.Data.map((item, itemIndex) => (
                  <M.TableCell key={itemIndex}>{item.VarCharValue}</M.TableCell>
                ))}
            </M.TableRow>
          ))}
        </M.TableBody>
      </M.Table>

      {(hasPagination || !!onLoadMore) && (
        <div className={classes.footer}>
          {hasPagination && (
            <Lab.Pagination
              count={Math.ceil(tail.length / pageSize)}
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
