import * as React from 'react'

import * as M from '@material-ui/core'

import Cell from './Cell'
import { Actions, ColumnIds } from './State'

const useStyles = M.makeStyles((t) => ({
  inputCell: {
    borderRight: `1px solid ${t.palette.divider}`,
    borderLeft: `1px solid ${t.palette.divider}`,
    padding: 0,
    width: t.spacing(20),
  },

  buttonCell: {
    padding: t.spacing(0, 1),
    width: t.spacing(36),
  },
}))

export default function AddRow({ columnPath, keysList, onAdd, onExpand }) {
  const classes = useStyles()

  const onChange = React.useCallback(
    (_, __, value) => {
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
              original: {
                keysList,
              },
              values: {
                [ColumnIds.Key]: '',
              },
            },
            value: '',
          }}
        />
      </M.TableCell>
      <M.TableCell className={classes.buttonCell} />
    </M.TableRow>
  )
}
