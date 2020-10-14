import * as React from 'react'
import cx from 'classnames'

import * as M from '@material-ui/core'

import { ColumnIds } from 'utils/json'

const useStyles = M.makeStyles((t) => ({
  root: {},

  rootSelected: {},

  cell: {
    padding: 0,
  },

  key: {
    width: t.spacing(20),
  },

  value: {
    width: t.spacing(36),
  },
}))

export default function Row({
  cells,
  columnPath,
  menu,
  onExpand,
  onMenuOpen,
  onMenuSelect,
}) {
  const classes = useStyles()

  const [selected, setSelected] = React.useState(false)

  // TODO: add RowWrapper
  //       use it for AddRow
  return (
    <M.ClickAwayListener onClickAway={() => setSelected(false)}>
      <M.TableRow
        className={cx({ [classes.rootSelected]: selected })}
        onClick={() => setSelected(true)}
      >
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
              menu,
              onExpand,
              onMenuOpen,
              onMenuSelect,
            })}
          </M.TableCell>
        ))}
      </M.TableRow>
    </M.ClickAwayListener>
  )
}
