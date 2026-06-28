import * as React from 'react'
import * as M from '@material-ui/core'
import type { CSSProperties } from '@material-ui/core/styles/withStyles'

import type { Column } from './Table'

// Immutable.js Set-like collection used by the (optional) selection model.
interface SelectionSet<T> {
  size: number
  equals: (other: SelectionSet<T>) => boolean
}

interface Selection<Row> {
  selected: SelectionSet<Row>
  all: SelectionSet<Row>
  toggleAll: () => void
}

interface Ordering<Row> {
  column: Column<Row>
  direction: 'asc' | 'desc'
  change: (col: Column<Row>) => void
}

interface HeadProps<Row> {
  columns: Column<Row>[]
  selection?: Selection<Row>
  ordering: Ordering<Row>
  withInlineActions?: boolean
}

export function Head<Row>({
  columns,
  selection: sel = undefined,
  ordering: ord,
  withInlineActions = false,
}: HeadProps<Row>) {
  return (
    <M.TableHead>
      <M.TableRow>
        {!!sel && (
          <M.TableCell padding="checkbox" onClick={sel.toggleAll}>
            <M.Checkbox
              indeterminate={sel.selected.size > 0 && sel.selected.size < sel.all.size}
              checked={sel.selected.equals(sel.all)}
            />
          </M.TableCell>
        )}
        {columns.map((col) => (
          <M.TableCell
            key={col.id}
            sortDirection={ord.column === col ? ord.direction : false}
            align={col.align}
          >
            {col.sortable === false ? (
              col.label
            ) : (
              <M.Tooltip
                title={col.hint || 'Sort'}
                placement="bottom-start"
                enterDelay={300}
              >
                <M.TableSortLabel
                  active={ord.column === col}
                  direction={ord.direction}
                  onClick={() => ord.change(col)}
                >
                  {col.label}
                </M.TableSortLabel>
              </M.Tooltip>
            )}
          </M.TableCell>
        ))}
        {withInlineActions && <M.TableCell align="right">&nbsp;</M.TableCell>}
      </M.TableRow>
    </M.TableHead>
  )
}

const usePaginationStyles = M.makeStyles((t) => ({
  toolbar: {
    // JSS array → "<n>px !important", which MUI's CSSProperties does not model
    paddingRight: [
      t.spacing(1),
      '!important',
    ] as unknown as CSSProperties['paddingRight'],
  },
}))

interface PaginationModel {
  total: number
  perPage: number
  page: number
  goToPage: (page: number) => void
  setPerPage: (perPage: number) => void
}

// Escape-hatch wrapper: forwards arbitrary extra props to MUI's polymorphic
// TablePagination, so the rest props are intentionally loose.
type PaginationProps = {
  pagination: PaginationModel
} & Record<string, any>

export function Pagination({ pagination, ...rest }: PaginationProps) {
  const classes = usePaginationStyles()
  return (
    <M.TablePagination
      classes={classes}
      component="div"
      count={pagination.total}
      rowsPerPage={pagination.perPage}
      page={pagination.page - 1}
      onChangePage={(e, page) => pagination.goToPage(page + 1)}
      onChangeRowsPerPage={(e) =>
        pagination.setPerPage(e.target.value as unknown as number)
      }
      {...rest}
    />
  )
}
