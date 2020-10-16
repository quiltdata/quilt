import * as React from 'react'
import cx from 'classnames'

import * as M from '@material-ui/core'

import { ColumnIds } from './State'

const useStyles = M.makeStyles((t) => ({
  root: {},

  cell: {
    padding: 0,
  },

  key: {
    width: t.spacing(20),
  },

  value: {
    width: t.spacing(49),
  },
}))

export default function Row({ cells, columnPath, onExpand, onMenuAction }) {
  const classes = useStyles()

  return (
    <M.TableRow>
      {cells.map((cell) => (
        <M.TableCell
          {...cell.getCellProps()}
          className={cx(classes.cell, {
            [classes.key]: cell.column.id === ColumnIds.Key,
            [classes.value]: cell.column.id === ColumnIds.Value,
          })}
        >
          {cell.render('Cell', {
            columnPath,
            onExpand,
            onMenuAction,
          })}
        </M.TableCell>
      ))}
    </M.TableRow>
  )
}
