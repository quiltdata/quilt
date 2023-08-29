import cx from 'classnames'
import * as R from 'ramda'
import * as React from 'react'
import * as M from '@material-ui/core'
import { lighten } from '@material-ui/core/styles/colorManipulator'

import useMemoEq from 'utils/useMemoEq'

interface UseFilteringProps<Row> {
  rows: readonly Row[]
  filterBy: (r: Row) => string
}

export function useFiltering<Row>({ rows, filterBy }: UseFilteringProps<Row>) {
  const [value, onChange] = React.useState('')
  const filtered = React.useMemo(
    () =>
      value
        ? rows.filter((row) => filterBy(row).toLowerCase().includes(value.toLowerCase()))
        : rows,
    [filterBy, value, rows],
  )
  return { value, onChange, filtered }
}

type Direction = 'asc' | 'desc'

const changeDirection = (d: Direction) => (d === 'asc' ? 'desc' : 'asc')

export type Column<Row> = {
  align?: M.TableCellProps['align']
  getDisplay?: (v: $TSFixMe, r: Row, opts?: $TSFixMe) => React.ReactNode
  getValue: (r: Row) => $TSFixMe
  hint?: M.TooltipProps['title']
  id: string
  label: React.ReactNode
  props?: M.TableCellProps
  sortBy?: (r: Row) => string
  sortable?: boolean
}

interface UseOrderingProps<Row> {
  rows: readonly Row[]
  direction?: Direction
  column: Column<Row>
}

export function useOrdering<Row>({ rows, ...opts }: UseOrderingProps<Row>) {
  const [column, setColumn] = React.useState(opts.column)
  const [direction, setDirection] = React.useState(opts.direction || 'asc')

  const sortBy = column.sortBy || column.getValue
  const sort = React.useMemo(
    () =>
      R.pipe<readonly Row[], Row[], Row[]>(
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

export type Action =
  | {
      href: string
      icon: React.ReactNode
      title: string
      fn?: () => void
    }
  | {
      fn: () => void
      icon: React.ReactNode
      title: string
      href?: undefined
    }
  | null

export const renderAction = (a: Action) => {
  if (!a) return null
  return (
    <M.Tooltip title={a.title} key={a.title}>
      {a.href ? (
        <M.IconButton
          aria-label={a.title}
          onClick={a.fn}
          href={a.href}
          component="a"
          target="_blank"
        >
          {a.icon}
        </M.IconButton>
      ) : (
        <M.IconButton aria-label={a.title} onClick={a.fn}>
          {a.icon}
        </M.IconButton>
      )}
    </M.Tooltip>
  )
}

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

interface ToolbarProps {
  heading: React.ReactNode
  children?: React.ReactNode
  selected?: number
  actions?: Action[]
  selectedActions?: Action[]
}

export function Toolbar({
  heading,
  selected = 0,
  actions = [],
  selectedActions = [],
  children,
}: ToolbarProps) {
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
      {children}
      <div className={classes.actions}>
        {(selected > 0 ? selectedActions : actions).map(renderAction)}
      </div>
    </M.Toolbar>
  )
}

const useInlineActionsStyles = M.makeStyles((t) => ({
  root: {
    opacity: 0.3,
    paddingRight: t.spacing(1),
    textAlign: 'right',
    transition: 'opacity 100ms',
    whiteSpace: 'nowrap',

    'tr:hover &': {
      opacity: 1,
    },
  },
}))

interface InlineActionsProps extends React.HTMLAttributes<HTMLDivElement> {
  actions?: Action[]
  children?: React.ReactNode
}

export function InlineActions({
  actions = [],
  children = undefined,
  ...props
}: InlineActionsProps) {
  const classes = useInlineActionsStyles()
  return (
    <div className={classes.root} {...props}>
      {actions.map(renderAction)}
      {children}
    </div>
  )
}

const useWrapperStyles = M.makeStyles({
  root: {
    overflowX: 'auto',
  },
})

export function Wrapper({
  className = undefined,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  const classes = useWrapperStyles()
  return <div className={cx(classes.root, className)} {...props} />
}

const useProgressStyles = M.makeStyles((t) => ({
  root: {
    marginBottom: t.spacing(2),
    marginLeft: t.spacing(3),
  },
}))

export function Progress(props: M.CircularProgressProps) {
  const classes = useProgressStyles()
  return <M.CircularProgress classes={classes} {...props} />
}
