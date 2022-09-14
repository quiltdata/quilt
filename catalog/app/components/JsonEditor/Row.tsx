import cx from 'classnames'
import * as React from 'react'
import * as RTable from 'react-table'
import * as M from '@material-ui/core'

import { COLUMN_IDS, RowData } from './constants'

const useStyles = M.makeStyles((t) => ({
  cell: {
    border: `1px solid ${t.palette.grey[400]}`,
    padding: 0,
  },
  error: {
    borderColor: t.palette.error.main,
  },
  key: {
    width: '50%',
    [t.breakpoints.up('lg')]: {
      width: t.spacing(27),
    },
  },
  value: {
    width: '50%',
    [t.breakpoints.up('lg')]: {
      width: t.spacing(40),
    },
  },
}))

interface RowProps {
  cells: RTable.Cell<RowData>[]
  columnPath: string[]
  contextMenuPath: string[]
  fresh: boolean
  onContextMenu: (path: string[]) => void
  onExpand: (path: string[]) => void
  onRemove: (path: string[]) => void
}

export default function Row({
  cells,
  columnPath,
  contextMenuPath,
  fresh,
  onContextMenu,
  onExpand,
  onRemove,
}: RowProps) {
  const classes = useStyles()

  return (
    <M.TableRow>
      {cells.map((cell) => (
        <M.TableCell
          {...cell.getCellProps()}
          className={cx(classes.cell, {
            [classes.error]: cell.row.original.errors.length,
            [classes.key]: cell.column.id === COLUMN_IDS.KEY,
            [classes.value]: cell.column.id === COLUMN_IDS.VALUE,
          })}
        >
          {cell.render('Cell', {
            columnPath,
            contextMenuPath,
            editing: fresh && cell.column.id === COLUMN_IDS.VALUE,
            onContextMenu,
            onExpand,
            onRemove,
          })}
        </M.TableCell>
      ))}
    </M.TableRow>
  )
}
