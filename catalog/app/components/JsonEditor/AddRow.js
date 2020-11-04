import * as React from 'react'

import * as M from '@material-ui/core'

import Cell from './Cell'
import { Actions, ColumnIds, EmptyValue } from './State'

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

export default function AddRow({ columnPath, onAdd, onExpand }) {
  const classes = useStyles()

  const onChange = React.useCallback(
    (_, __, value) => {
      if (!value) return
      onAdd(columnPath, value)
    },
    [columnPath, onAdd],
  )

  const onMenuAction = React.useCallback(
    (_, action) => {
      if (action.action !== Actions.Select) return

      onAdd(columnPath, action.title)
    },
    [columnPath, onAdd],
  )

  return (
    <M.TableRow>
      <M.TableCell className={classes.inputCell}>
        <Cell
          {...{
            columnPath,
            onExpand,
            onMenuAction,
            updateMyData: onChange,
            column: {
              id: ColumnIds.Key,
            },
            row: {
              original: {},
              values: {
                [ColumnIds.Key]: '',
              },
            },
            value: EmptyValue,
          }}
        />
      </M.TableCell>

      <M.TableCell className={classes.emptyCell} />
    </M.TableRow>
  )
}
