import Athena from 'aws-sdk/clients/athena'
import * as React from 'react'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

const useStyles = M.makeStyles((t) => ({
  header: {
    margin: t.spacing(0, 0, 1),
  },
  cell: {
    '& + &': {
      textAlign: 'right',
    },
  },
  footer: {
    display: 'flex',
    padding: t.spacing(1),
  },
  more: {
    marginLeft: 'auto',
  },
}))

interface AthenaResultsProps {
  results: Athena.RowList
  onLoadMore?: () => void
}

export default function AthenaResults({ results, onLoadMore }: AthenaResultsProps) {
  const classes = useStyles()

  const head = results[0]
  const tail = results.slice(1)

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

  /* eslint-disable react/no-array-index-key */

  return (
    <div>
      <M.Typography className={classes.header} variant="body1">
        Query Results
      </M.Typography>

      <M.TableContainer component={M.Paper}>
        <M.Table size="small">
          <M.TableHead>
            <M.TableRow>
              {head?.Data &&
                head.Data.map((item, index) => (
                  <M.TableCell className={classes.cell} key={index}>
                    {item.VarCharValue}
                  </M.TableCell>
                ))}
            </M.TableRow>
          </M.TableHead>
          <M.TableBody>
            {rowsPaginated.map((row, rowIndex) => (
              <M.TableRow key={rowIndex}>
                {row.Data &&
                  row.Data.map((item, itemIndex) => (
                    <M.TableCell className={classes.cell} key={itemIndex}>
                      {item.VarCharValue}
                    </M.TableCell>
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
    </div>
  )
}
