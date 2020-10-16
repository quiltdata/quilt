import * as React from 'react'

import * as M from '@material-ui/core'

import Cell from './Cell'
import { Actions, ColumnIds } from './State'

const useStyles = M.makeStyles((t) => ({
  inputCell: {
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

  const [value, setValue] = React.useState('')

  const onChange = React.useCallback(
    (_, __, newValue) => {
      setValue(newValue)
    },
    [setValue],
  )

  const onMenuAction = React.useCallback(
    (_, action) => {
      if (!Actions.Select) return

      setValue(action.title)
    },
    [setValue],
  )

  const onSubmit = React.useCallback(() => {
    onAdd(columnPath, value)
  }, [columnPath, onAdd, value])

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
            value,
          }}
        />
      </M.TableCell>
      <M.TableCell className={classes.buttonCell}>
        <M.Button disabled={!value} variant="contained" size="small" onClick={onSubmit}>
          <M.Icon>add</M.Icon>
          Add field
        </M.Button>
      </M.TableCell>
    </M.TableRow>
  )
}
