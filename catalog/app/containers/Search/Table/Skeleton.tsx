import * as React from 'react'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

const randomColumnWidth = (min: number = 80, max: number = 200) =>
  min + Math.floor(Math.random() * (max - min + 1))

const createColumns = (columnsLen: number) =>
  Array.from({ length: columnsLen }).map((_c, key) => ({
    key,
    width: randomColumnWidth(),
  }))

export const useColumns = (rowsLen: number = 30, columnsLen: number = 5) =>
  React.useMemo(
    () =>
      Array.from({ length: rowsLen }).map((_r, key) => ({
        key,
        columns: createColumns(columnsLen),
      })),
    [columnsLen, rowsLen],
  )

interface SkeletonCellProps {
  width: number
}

export const Cell = ({ width }: SkeletonCellProps) => (
  <M.TableCell>
    <M.Typography variant="subtitle2">
      <Lab.Skeleton width={width} />
    </M.Typography>
  </M.TableCell>
)

export const Head = Cell

interface TableProps {
  className?: string
}

export function Table({ className }: TableProps) {
  const [head, ...body] = useColumns()
  return (
    <M.Table className={className} size="small">
      <M.TableHead>
        <M.TableRow>
          <M.TableCell />
          {head.columns.map(({ key, width }) => (
            <Cell key={key} width={width} />
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
              <Cell key={key} width={width} />
            ))}
          </M.TableRow>
        ))}
      </M.TableBody>
    </M.Table>
  )
}
