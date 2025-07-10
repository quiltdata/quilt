import * as React from 'react'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

export interface Column {
  key: React.Key
  width: number
}

export interface Row {
  key: React.Key
  columns: Column[]
}

const randomColumnWidth = (min: number = 80, max: number = 200) =>
  min + Math.floor(Math.random() * (max - min + 1))

const createColumns = (columnsLen: number): Column[] =>
  Array.from({ length: columnsLen }).map((_c, key) => ({
    key,
    width: randomColumnWidth(),
  }))

export const useSkeletonSizes = (rowsLen: number = 30, columnsLen: number = 5): Row[] =>
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
  const rows = useSkeletonSizes()
  if (!rows.length) return null
  const [head, ...body] = rows
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
