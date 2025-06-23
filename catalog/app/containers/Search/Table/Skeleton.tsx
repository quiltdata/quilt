import * as React from 'react'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

interface TableSkeletonProps {
  className?: string
}

export default function TableSkeleton({ className }: TableSkeletonProps) {
  const COLUMNS_LEN = 5
  const ROWS_LEN = 30
  const [head, ...body] = React.useMemo(
    () =>
      Array.from({ length: ROWS_LEN }).map((_r, row) => ({
        key: row,
        columns: Array.from({ length: COLUMNS_LEN }).map((_c, key) => ({
          key,
          width: Math.max(80, Math.ceil(Math.random() * 200)),
        })),
      })),
    [],
  )
  return (
    <M.Table className={className} size="small">
      <M.TableHead>
        <M.TableRow>
          <M.TableCell />
          {head.columns.map(({ key, width }) => (
            <M.TableCell key={key}>
              <M.Typography variant="subtitle2">
                <Lab.Skeleton width={width} />
              </M.Typography>
            </M.TableCell>
          ))}
        </M.TableRow>
      </M.TableHead>
      <M.TableBody>
        {body.map((r) => (
          <M.TableRow key={r.key}>
            <M.TableCell padding="checkbox">
              <Lab.Skeleton />
            </M.TableCell>
            {r.columns.map(({ key, width }) => (
              <M.TableCell key={key}>
                <M.Typography variant="subtitle2">
                  <Lab.Skeleton width={width} />
                </M.Typography>
              </M.TableCell>
            ))}
          </M.TableRow>
        ))}
      </M.TableBody>
    </M.Table>
  )
}
