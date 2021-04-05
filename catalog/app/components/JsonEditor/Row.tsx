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
  fresh: boolean
  onExpand: (path: string[]) => void
  onRemove: (path: string[]) => void
}

export default function Row({ cells, columnPath, fresh, onExpand, onRemove }: RowProps) {
  const classes = useStyles()

  return (
    <M.TableRow>
      {cells.map((cell) => (
        <M.TableCell
          {...cell.getCellProps()}
          className={cx(classes.cell, {
            [classes.key]: cell.column.id === COLUMN_IDS.KEY,
            [classes.value]: cell.column.id === COLUMN_IDS.VALUE,
          })}
        >
          {cell.render('Cell', {
            editing: fresh && cell.column.id === COLUMN_IDS.VALUE,
            columnPath,
            onExpand,
            onRemove,
          })}
        </M.TableCell>
      ))}
    </M.TableRow>
  )
}
