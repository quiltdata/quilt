import * as React from 'react'

import * as M from '@material-ui/core'

import Cell from './Cell'
import { ColumnIds } from './State'

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

export default function AddRow({ columnPath, menu, onAdd, onExpand, onMenuOpen }) {
  const classes = useStyles()

  const [value, setValue] = React.useState('')

  const onChange = React.useCallback(
    (_, __, newValue) => {
      setValue(newValue)
    },
    [setValue],
  )

  const onMenuSelect = React.useCallback(
    (_, newValue) => {
      setValue(newValue)
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
            menu,
            onExpand,
            onMenuOpen,
            onMenuSelect,
            updateMyData: onChange,
            column: {
              id: ColumnIds.Key,
            },
            row: {
              values: {},
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
