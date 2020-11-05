import * as React from 'react'
import * as M from '@material-ui/core'

import Cell from './Cell'
import { COLUMN_IDS, EMPTY_VALUE } from './State'

const useStyles = M.makeStyles((t) => ({
  inputCell: {
    border: `1px solid ${t.palette.grey[400]}`,
    padding: 0,
    width: t.spacing(20),
  },
  emptyCell: {
    border: `1px solid ${t.palette.grey[400]}`,
    width: t.spacing(36),
  },
}))

const emptyCellProps = {
  column: {
    id: COLUMN_IDS.Key,
  },
  row: {
    original: {},
    values: {
      [COLUMN_IDS.Key]: EMPTY_VALUE,
    },
  },
  value: EMPTY_VALUE,
}

export default function AddRow({ columnPath, onAdd, onExpand }) {
  const classes = useStyles()

  const onChange = React.useCallback(
    (_1, _2, value) => {
      if (!value) return
      onAdd(columnPath, value)
    },
    [columnPath, onAdd],
  )

  const onMenuAction = React.useCallback(() => {
    // eslint-disable-next-line no-console
    console.error('It should not happen')
  }, [])

  return (
    <M.TableRow>
      <M.TableCell className={classes.inputCell}>
        <Cell
          {...{
            ...emptyCellProps,
            columnPath,
            onExpand,
            onMenuAction,
            updateMyData: onChange,
          }}
        />
      </M.TableCell>

      <M.TableCell className={classes.emptyCell} />
    </M.TableRow>
  )
}
