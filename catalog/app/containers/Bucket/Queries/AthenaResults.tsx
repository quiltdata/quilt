import * as React from 'react'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import * as requests from './requests'

interface AthenaResultsProps {
  results: requests.athena.QueryResults
}

export default function AthenaResults({ results }: AthenaResultsProps) {
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

  const rowsPaginated = tail.slice(pageSize * page, pageSize * (page + 1))

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

      <Lab.Pagination
        count={Math.floor(tail.length / pageSize)}
        page={page}
        size="small"
        onChange={handlePagination}
      />
    </M.TableContainer>
  )
}
