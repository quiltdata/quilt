import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import * as Format from 'utils/format'
import { readableBytes } from 'utils/string'

export const HEIGHT = 32

interface Entry {
  modifiedDate: Date
  name: string
  size: number
}

const useCellStyles = M.makeStyles({
  root: {
    alignItems: 'center',
    display: 'flex',
    height: `${HEIGHT}px`,
    overflow: 'hidden',
  },
  wrap: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
})

interface CellProps {
  children: React.ReactNode
  className: string
  onClick?: () => void
}

function Cell({ className, children, onClick }: CellProps) {
  const classes = useCellStyles()
  return (
    <div className={cx(classes.root, className)} onClick={onClick}>
      <span className={classes.wrap}>{children}</span>
    </div>
  )
}

interface NameProps {
  className: string
  onClick: () => void
  value: string
}

function Name({ className, onClick, value }: NameProps) {
  return (
    <Cell className={className} onClick={onClick}>
      {value}
    </Cell>
  )
}

interface ModifiedDateProps {
  className: string
  value: Date
}

function ModifiedDate({ className, value }: ModifiedDateProps) {
  return (
    <Cell className={className}>
      <span title={value.toLocaleString()}>
        <Format.Relative value={value} />
      </span>
    </Cell>
  )
}

interface SizeProps {
  className: string
  value: number
}

function Size({ className, value }: SizeProps) {
  return (
    <Cell className={className}>
      <span title={`${value}B`}>{readableBytes(value)}</span>
    </Cell>
  )
}

const useStyles = M.makeStyles((t) => ({
  root: {
    alignItems: 'center',
    display: 'flex',
    height: `${HEIGHT}px`,
    position: 'relative',
    whiteSpace: 'nowrap',
    '&:hover': {
      background: t.palette.background.paper,
      borderRadius: t.shape.borderRadius,
      boxShadow: t.shadows[4],
      marginLeft: `-${HEIGHT}px`,
      marginRight: `-${HEIGHT}px`,
    },
    '&:hover $dragHandle': {
      display: 'flex',
    },
    '&:hover $menuHandle': {
      display: 'flex',
    },
  },
  dragHandle: {
    alignItems: 'center',
    color: t.palette.text.hint,
    cursor: 'grab',
    display: 'none',
    height: `${HEIGHT}px`,
    justifyContent: 'center',
    width: `${HEIGHT}px`,
    '&:hover': {
      color: t.palette.text.primary,
    },
  },
  checkbox: {
    padding: t.spacing(0.5),
  },
  name: {
    cursor: 'pointer',
    flexGrow: 1,
    paddingLeft: t.spacing(0.5),
  },
  modifiedDate: {
    flexShrink: 0,
    padding: t.spacing(0, 0.5),
    width: t.spacing(20),
  },
  size: {
    flexShrink: 0,
    justifyContent: 'flex-end',
    padding: t.spacing(0, 0.5),
    width: t.spacing(12),
  },
  menuHandle: {
    alignItems: 'center',
    color: t.palette.text.hint,
    display: 'none',
    height: `${HEIGHT}px`,
    justifyContent: 'center',
    width: `${HEIGHT}px`,
    '&:hover': {
      color: t.palette.text.primary,
    },
  },
  icon: {
    height: `${HEIGHT}px`,
    width: `${HEIGHT}px`,
  },
}))

export interface FileRowProps {
  entry: Entry
  expanded: boolean
  hasChildren?: boolean
  onClick: () => void
  onSelect: (v: boolean) => void
  onToggle: () => void
  selected: boolean
}

export default function FileRow({
  entry,
  expanded,
  hasChildren = false,
  onClick,
  onSelect,
  onToggle,
  selected,
}: FileRowProps) {
  const { name, modifiedDate, size } = entry
  const classes = useStyles()
  const iconStr = React.useMemo(() => {
    if (!hasChildren) return 'insert_drive_file'
    return expanded ? 'folder_open' : 'folder'
  }, [expanded, hasChildren])
  return (
    <div className={classes.root}>
      <div className={classes.dragHandle}>
        <M.Icon fontSize="small">drag_handle</M.Icon>
      </div>
      <M.Checkbox
        className={classes.checkbox}
        checked={selected}
        onChange={(e, v) => onSelect(v)}
      />
      <M.IconButton size="small" className={cx(classes.icon)} onClick={onToggle}>
        <M.Icon fontSize="small">{iconStr}</M.Icon>
      </M.IconButton>
      <Name className={classes.name} value={name} onClick={onClick} />
      <ModifiedDate className={classes.modifiedDate} value={modifiedDate} />
      <Size className={classes.size} value={size} />
      <div className={classes.menuHandle}>
        <M.IconButton size="small" color="inherit">
          <M.Icon fontSize="small">more_horiz</M.Icon>
        </M.IconButton>
      </div>
    </div>
  )
}
