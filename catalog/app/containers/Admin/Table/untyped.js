import * as React from 'react'
import * as M from '@material-ui/core'

export function Head({
  columns,
  selection: sel = undefined,
  ordering: ord,
  withInlineActions = false,
}) {
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
    paddingRight: [t.spacing(1), '!important'],
  },
}))

export function Pagination({ pagination, ...rest }) {
  const classes = usePaginationStyles()
  return (
    <M.TablePagination
      classes={classes}
      component="div"
      count={pagination.total}
      rowsPerPage={pagination.perPage}
      page={pagination.page - 1}
      onChangePage={(e, page) => pagination.goToPage(page + 1)}
      onChangeRowsPerPage={(e) => pagination.setPerPage(e.target.value)}
      {...rest}
    />
  )
}
