import cx from 'classnames'
import * as I from 'immutable'
import PT from 'prop-types'
import * as R from 'ramda'
import * as React from 'react'
import * as RC from 'recompose'
import Checkbox from '@material-ui/core/Checkbox'
import CircularProgress from '@material-ui/core/CircularProgress'
import IconButton from '@material-ui/core/IconButton'
import TableCell from '@material-ui/core/TableCell'
import TableHead from '@material-ui/core/TableHead'
import TablePagination from '@material-ui/core/TablePagination'
import TableRow from '@material-ui/core/TableRow'
import TableSortLabel from '@material-ui/core/TableSortLabel'
import MuiToolbar from '@material-ui/core/Toolbar'
import Tooltip from '@material-ui/core/Tooltip'
import Typography from '@material-ui/core/Typography'
import { withStyles } from '@material-ui/styles'
import { lighten } from '@material-ui/core/styles/colorManipulator'

import * as RT from 'utils/reactTools'
import useMemoEq from 'utils/useMemoEq'

const changeDirection = (d) => (d === 'asc' ? 'desc' : 'asc')

export const useOrdering = ({ rows, ...opts }) => {
  const [column, setColumn] = React.useState(opts.column)
  const [direction, setDirection] = React.useState(opts.direction || 'asc')

  const sortBy = column.sortBy || column.getValue
  const sort = React.useCallback(
    R.pipe(
      R.sortBy(sortBy),
      direction === 'asc' ? R.identity : R.reverse,
    ),
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

export const useSelection = ({ rows, getId = R.unary(I.fromJS) }) => {
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
  <Tooltip title={a.title} key={a.title}>
    <IconButton aria-label={a.title} onClick={a.fn}>
      {a.icon}
    </IconButton>
  </Tooltip>
)

export const Toolbar = RT.composeComponent(
  'Admin.Table.Toolbar',
  RC.setPropTypes({
    heading: PT.node,
    selected: PT.number,
    actions: PT.array,
    selectedActions: PT.array,
  }),
  withStyles((t) => ({
    root: {
      paddingRight: t.spacing.unit,
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
  })),
  ({ classes, heading, selected = 0, actions = [], selectedActions = [] }) => (
    <MuiToolbar
      className={cx(classes.root, {
        [classes.highlight]: selected > 0,
      })}
    >
      <div className={classes.title}>
        {selected > 0 ? (
          <Typography color="inherit" variant="subtitle1">
            {selected} selected
          </Typography>
        ) : (
          <Typography variant="h6">{heading}</Typography>
        )}
      </div>
      <div className={classes.spacer} />
      <div className={classes.actions}>
        {(selected > 0 ? selectedActions : actions).map(renderAction)}
      </div>
    </MuiToolbar>
  ),
)

export const Head = RT.composeComponent(
  'Admin.Table.Head',
  RC.setPropTypes({
    columns: PT.array.isRequired,
    selection: PT.object,
    ordering: PT.object.isRequired,
    withInlineActions: PT.bool,
  }),
  ({ columns, selection: sel, ordering: ord, withInlineActions = false }) => (
    <TableHead>
      <TableRow>
        {!!sel && (
          <TableCell padding="checkbox" onClick={sel.toggleAll}>
            <Checkbox
              indeterminate={sel.selected.size > 0 && sel.selected.size < sel.all.size}
              checked={sel.selected.equals(sel.all)}
            />
          </TableCell>
        )}
        {columns.map((col) => (
          <TableCell
            key={col.id}
            sortDirection={ord.column === col ? ord.direction : false}
          >
            <Tooltip title={col.hint || 'Sort'} placement="bottom-start" enterDelay={300}>
              <TableSortLabel
                active={ord.column === col}
                direction={ord.direction}
                onClick={() => ord.change(col)}
              >
                {col.label}
              </TableSortLabel>
            </Tooltip>
          </TableCell>
        ))}
        {withInlineActions && <TableCell align="right">Actions</TableCell>}
      </TableRow>
    </TableHead>
  ),
)

export const Wrapper = RT.composeComponent(
  'Admin.Table.Wrapper',
  withStyles(() => ({
    root: {
      overflowX: 'auto',
    },
  })),
  ({ classes, className, ...props }) => (
    <div className={cx(classes.root, className)} {...props} />
  ),
)

export const InlineActions = RT.composeComponent(
  'Admin.Table.InlineActions',
  RC.setPropTypes({
    actions: PT.array,
  }),
  withStyles((t) => ({
    root: {
      opacity: 0,
      paddingRight: t.spacing.unit,
      textAlign: 'right',
      transition: 'opacity 100ms',

      'tr:hover &': {
        opacity: 1,
      },
    },
  })),
  ({ classes, actions = [], children, ...props }) => (
    <div className={classes.root} {...props}>
      {actions.map(renderAction)}
      {children}
    </div>
  ),
)

export const Progress = RT.composeComponent(
  'Admin.Table.Progress',
  withStyles((t) => ({
    root: {
      marginBottom: t.spacing.unit * 2,
      marginLeft: t.spacing.unit * 3,
    },
  })),
  CircularProgress,
)

export const Pagination = RT.composeComponent(
  'Admin.Table.Pagination',
  RC.setPropTypes({
    pagination: PT.object.isRequired,
  }),
  withStyles((t) => ({
    toolbar: {
      paddingRight: [t.spacing.unit, '!important'],
    },
  })),
  ({ classes, pagination, ...rest }) => (
    <TablePagination
      classes={classes}
      component="div"
      count={pagination.total}
      rowsPerPage={pagination.perPage}
      page={pagination.page - 1}
      onChangePage={(e, page) => pagination.goToPage(page + 1)}
      onChangeRowsPerPage={(e) => pagination.setPerPage(e.target.value)}
      {...rest}
    />
  ),
)
