import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import { COLUMN_IDS } from './State'

const useStyles = M.makeStyles((t) => ({
  cell: {
    border: `1px solid ${t.palette.grey[400]}`,
    padding: 0,
  },
  key: {
    width: t.spacing(28),
  },
  value: {
    width: t.spacing(40),
  },
}))

export default function Row({ cells, columnPath, fresh, onExpand, onMenuAction }) {
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
            onMenuAction,
          })}
        </M.TableCell>
      ))}
    </M.TableRow>
  )
}
