import cx from 'classnames'
import * as I from 'immutable'
import * as R from 'ramda'
import * as React from 'react'
import * as M from '@material-ui/core'
import { lighten } from '@material-ui/core/styles/colorManipulator'

import useMemoEq from 'utils/useMemoEq'

const changeDirection = (d) => (d === 'asc' ? 'desc' : 'asc')

export function useOrdering({ rows, ...opts }) {
  const [column, setColumn] = React.useState(opts.column)
  const [direction, setDirection] = React.useState(opts.direction || 'asc')

  const sortBy = column.sortBy || column.getValue
  const sort = React.useCallback(
    R.pipe(R.sortBy(sortBy), direction === 'asc' ? R.identity : R.reverse),
    [sortBy, direction],
  )

  const ordered = useMemoEq([sort, rows], () => sort(rows))

  const change = React.useCallback(
    (newCol) => {
      if (column !== newCol) {
        setColumn(newCol)
        setDirection('asc')
      } else {
        setDirection(changeDirection)
      }
    },
    [column, setColumn, setDirection],
  )

  return { column, direction, change, ordered }
}

const emptySet = I.Set()

export function useSelection({ rows, getId = R.unary(I.fromJS) }) {
  const [selected, setSelected] = React.useState(emptySet)
  const allSelected = React.useMemo(() => I.Set(rows.map(getId)), [rows, getId])

  const toggle = React.useCallback(
    (row) => {
      const id = getId(row)
      setSelected((s) => (s.has(id) ? s.delete(id) : s.add(id)))
    },
    [setSelected, getId],
  )

  const toggleAll = React.useCallback(() => {
    setSelected((s) => (s.equals(allSelected) ? emptySet : allSelected))
  }, [setSelected, allSelected])

  const clear = React.useCallback(() => {
    setSelected(emptySet)
  }, [setSelected])

  const isSelected = React.useCallback((row) => selected.has(getId(row)), [
    selected,
    getId,
  ])

  // eslint-disable-next-line object-curly-newline
  return { toggle, toggleAll, clear, isSelected, selected, all: allSelected }
}

export const renderAction = (a) => (
  <M.Tooltip title={a.title} key={a.title}>
    <M.IconButton aria-label={a.title} onClick={a.fn}>
      {a.icon}
    </M.IconButton>
  </M.Tooltip>
)

const useToolbarStyles = M.makeStyles((t) => ({
  root: {
    paddingRight: t.spacing(1),
  },
  highlight:
    t.palette.type === 'light'
      ? {
          color: t.palette.secondary.main,
          backgroundColor: lighten(t.palette.secondary.light, 0.85),
        }
      : {
          color: t.palette.text.primary,
          backgroundColor: t.palette.secondary.dark,
        },
  spacer: {
    flex: '1 1 100%',
  },
  actions: {
    color: t.palette.text.secondary,
  },
  title: {
    flex: '0 0 auto',
  },
}))

export function Toolbar({ heading, selected = 0, actions = [], selectedActions = [] }) {
  const classes = useToolbarStyles()
  return (
    <M.Toolbar className={cx(classes.root, { [classes.highlight]: selected > 0 })}>
      <div className={classes.title}>
        {selected > 0 ? (
          <M.Typography color="inherit" variant="subtitle1">
            {selected} selected
          </M.Typography>
        ) : (
          <M.Typography variant="h6">{heading}</M.Typography>
        )}
      </div>
      <div className={classes.spacer} />
      <div className={classes.actions}>
        {(selected > 0 ? selectedActions : actions).map(renderAction)}
      </div>
    </M.Toolbar>
  )
}

export function Head({
  columns,
  selection: sel,
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
        {withInlineActions && <M.TableCell align="right">Actions</M.TableCell>}
      </M.TableRow>
    </M.TableHead>
  )
}

const useWrapperStyles = M.makeStyles(() => ({
  root: {
    overflowX: 'auto',
  },
}))

export function Wrapper({ className, ...props }) {
  const classes = useWrapperStyles()
  return <div className={cx(classes.root, className)} {...props} />
}

const useInlineActionsStyles = M.makeStyles((t) => ({
  root: {
    opacity: 0,
    paddingRight: t.spacing(1),
    textAlign: 'right',
    transition: 'opacity 100ms',

    'tr:hover &': {
      opacity: 1,
    },
  },
}))

export function InlineActions({ actions = [], children, ...props }) {
  const classes = useInlineActionsStyles()
  return (
    <div className={classes.root} {...props}>
      {actions.map(renderAction)}
      {children}
    </div>
  )
}

const useProgressStyles = M.makeStyles((t) => ({
  root: {
    marginBottom: t.spacing(2),
    marginLeft: t.spacing(3),
  },
}))

export function Progress(props) {
  const classes = useProgressStyles()
  return <M.CircularProgress classes={classes} {...props} />
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
