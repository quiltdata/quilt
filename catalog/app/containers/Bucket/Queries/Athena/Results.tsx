import Athena from 'aws-sdk/clients/athena'
import * as React from 'react'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

const useStyles = M.makeStyles((t) => ({
  footer: {
    display: 'flex',
    padding: t.spacing(1),
  },
  header: {
    margin: t.spacing(0, 0, 1),
  },
  more: {
    marginLeft: 'auto',
  },
}))

interface ResultsProps {
  results: Athena.RowList
  onLoadMore?: () => void
}

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

export default function Results({ results: [head, ...tail], onLoadMore }: ResultsProps) {
  const classes = useStyles()

  const pageSize = 10
  const [page, setPage] = React.useState(1)

  const handlePagination = React.useCallback(
    (event, value) => {
      setPage(value)
    },
    [setPage],
  )

  if (!tail.length) return <Empty />

  const rowsPaginated = tail.slice(pageSize * (page - 1), pageSize * page)
  const hasPagination = tail.length > rowsPaginated.length

  /* eslint-disable react/no-array-index-key */

  return (
    <M.TableContainer component={M.Paper}>
      <M.Table size="small">
        <M.TableHead>
          <M.TableRow>
            {head?.Data?.map((item, index) => (
              <M.TableCell key={index}>{item.VarCharValue}</M.TableCell>
            ))}
          </M.TableRow>
        </M.TableHead>
        <M.TableBody>
          {rowsPaginated.map((row, rowIndex) => (
            <M.TableRow key={rowIndex}>
              {row?.Data?.map((item, itemIndex) => (
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
