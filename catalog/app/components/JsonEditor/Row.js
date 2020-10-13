import * as React from 'react'
import cx from 'classnames'

import * as M from '@material-ui/core'

const useStyles = M.makeStyles(() => ({
  root: {},

  rootSelected: {},

  cell: {
    padding: 0,
    width: '225px',
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
          <M.TableCell {...cell.getCellProps()} className={classes.cell}>
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
